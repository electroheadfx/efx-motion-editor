import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoPhysicalCell,
} from '../roto/physicsPaintRotoPhysicalResolver';
import { projectPhysicsPaintLoopClipGeometry } from '../view/physicsPaintLoopClipPresentation';
import {
  getPhysicsPaintRotoSourceCycleId,
  togglePhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingSelection,
} from '../roto/physicsPaintRotoSpacingSelection';
import {
  classifyRotoDeleteTarget,
  classifyRotoInsertTarget,
  classifyRotoScissorTarget,
  mapRotoDeleteProductReason,
  mapRotoGroupDragProductReason,
  mapRotoInsertProductReason,
  mapRotoScissorProductReason,
  mapRotoKeyRailDragProductReason,
  buildKeyRailDragProposalVersion,
  useRotoTimelineActions,
  type RotoDeleteTarget,
  type RotoInsertTarget,
  type RotoTimelineActionsInput,
} from './useRotoTimelineActions';

const BLANK_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function blankPayload(appFrame: number): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: 0,
    appFrame,
    dataUrl: BLANK_PNG_DATA_URL,
    width: 100,
    height: 80,
  }) as PhysicPaintRotoRealKeyPayload;
}

function realKeyRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: blankPayload(appFrame),
  }) as PhysicPaintRotoRealKeyRecord;
}

interface GroupDeleteActivation {
  readonly operationKind: 'delete-group-frame' | 'delete-group';
  readonly groupId: string;
  readonly appFrame: number;
  readonly phaseOrigin: number;
  readonly onlyOccurrence: boolean;
}

interface HarnessOptions {
  records?: PhysicPaintRotoRealKeyRecord[];
  loopClips?: readonly PhysicPaintRotoLoopClip[];
  spacingSelection?: PhysicsPaintRotoSpacingSelection | null;
  physicalCells?: readonly PhysicPaintRotoPhysicalCell[];
  frameResolution?: PhysicPaintRotoFrameResolution;
  currentAppFrame?: number;
  getCurrentAppFrame?: () => number;
  launch?: PhysicPaintLaunchContext | null;
  pendingOperationId?: string | null;
  selectedKeyId?: string | null;
  selectedKeyIds?: readonly string[];
  selectedKeyRail?: Readonly<{ firstKeyId: string; keyIds: readonly string[] }> | null;
  selectedLoopClipIds?: readonly string[];
  selectedLoopRailDisplayName?: string | null;
  incomingInterpolationBreakKeyIds?: readonly string[];
  getIncomingInterpolationBreakKeyIds?: () => readonly string[];
  getRotoInterpolationState?: () => PhysicPaintRotoInterpolationState;
  getRotoLoopClips?: () => readonly PhysicPaintRotoLoopClip[];
  capacity?: number;
  parentEndExclusive?: number;
  blankDataUrl?: string;
  /** Omit the four physical-edit ports (executePhysicalEdit, getRotoKeyRecords, getRotoInterpolationState, getCapacity) to exercise the guard-order rejection path. */
  omitPhysicalEditPorts?: boolean;
  executeGroupLifecycleDelete?: (activation: GroupDeleteActivation) => Promise<boolean>;
  requestSoleOccurrenceDeleteWarning?: (activation: GroupDeleteActivation) => void;
  requestGroupDeleteChoice?: (target: Extract<RotoDeleteTarget, { kind: 'group-choice' }>) => void;
}

function createHarness(options: HarnessOptions = {}) {
  const records = options.records ?? [];
  const launch = options.launch === undefined
    ? ({ operationId: 'op-1', layerId: 'layer-1' } as PhysicPaintLaunchContext)
    : options.launch;
  const publishStatus = vi.fn();
  const publishDiagnostic = vi.fn();
  const executePhysicalEdit = vi.fn(async (_input: unknown) => true);
  const pendingOperationId = signal<string | null>(options.pendingOperationId ?? null);
  const input: RotoTimelineActionsInput = {
    getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
    ...(options.omitPhysicalEditPorts ? {} : {
      getRotoKeyRecords: () => records,
      getRotoInterpolationState: options.getRotoInterpolationState
        ?? (() => ({ enabled: false, mode: 'duplicate' })),
      getCapacity: () => options.capacity ?? 10,
      getParentEndExclusive: () => options.parentEndExclusive ?? options.capacity ?? 10,
      executePhysicalEdit: executePhysicalEdit as never,
    }),
    getRotoLoopClips: options.getRotoLoopClips ?? (() => options.loopClips ?? []),
    getRotoSpacingSelection: () => options.spacingSelection ?? null,
    getPhysicalCells: () => options.physicalCells ?? [],
    getFrameResolution: () => options.frameResolution ?? { kind: 'empty' },
    getSelectedKeyId: () => options.selectedKeyId ?? null,
    getSelectedKeyIds: () => options.selectedKeyIds ?? options.spacingSelection?.selectedSourceKeyIds ?? [],
    getSelectedKeyRail: () => options.selectedKeyRail ?? null,
    getSelectedLoopClipIds: () => options.selectedLoopClipIds ?? [],
    getSelectedLoopRailDisplayName: () => options.selectedLoopRailDisplayName ?? null,
    getCurrentAppFrame: options.getCurrentAppFrame ?? (() => options.currentAppFrame ?? 3),
    getLaunchContext: () => launch,
    getIncomingInterpolationBreakKeyIds: options.getIncomingInterpolationBreakKeyIds
      ?? (() => options.incomingInterpolationBreakKeyIds ?? []),
    buildBlankRotoFrame: (appFrame) => ({
      frameIndex: 0,
      appFrame,
      dataUrl: options.blankDataUrl ?? BLANK_PNG_DATA_URL,
      width: 100,
      height: 80,
      source: 'real-key',
    }),
    pendingOperationId,
    publishStatus,
    publishDiagnostic,
    executeGroupLifecycleDelete: options.executeGroupLifecycleDelete,
    requestSoleOccurrenceDeleteWarning: options.requestSoleOccurrenceDeleteWarning,
    requestGroupDeleteChoice: options.requestGroupDeleteChoice,
  } as RotoTimelineActionsInput & {
    executeGroupLifecycleDelete?: (activation: GroupDeleteActivation) => Promise<boolean>;
    requestSoleOccurrenceDeleteWarning?: (activation: GroupDeleteActivation) => void;
  };
  const actions = useRotoTimelineActions(input);
  return { actions, executePhysicalEdit, publishStatus, publishDiagnostic, pendingOperationId };
}

function spacingSelection(selectedSourceKeyIds: readonly string[]): PhysicsPaintRotoSpacingSelection {
  const sourceKeyIds = ['A', 'B', 'C', 'D', 'E'] as const;
  return {
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(sourceKeyIds),
    sourceKeyIds,
    selectedSourceKeyIds,
    anchorSourceIndex: sourceKeyIds.indexOf(selectedSourceKeyIds[0] as never),
  };
}

const linkedLoop: PhysicPaintRotoLoopClip = {
  loopId: 'loop-1',
  placementStart: 10,
  sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
  repeat: 3,
  mode: 'static',
};

function spacingLifecycleGroup(): PhysicPaintRotoLoopClip {
  return Object.freeze({
    loopId: 'spacing-group',
    placementStart: 10,
    sourceKeyIds: Object.freeze(['A', 'B', 'C']),
    repeat: 3,
    mode: 'progressive',
    scriptId: 'action-spacing',
    motion: Object.freeze({ deformation: 4, position: 2 }),
    overrideColor: '#123456',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 10,
    originalEndExclusive: 19,
    visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 19 })]),
    frameOverrides: Object.freeze([]),
  });
}

function lifecycleGroup(overrides: Partial<PhysicPaintRotoLoopClip> = {}): PhysicPaintRotoLoopClip {
  return Object.freeze({
    loopId: 'group-1',
    placementStart: 10,
    sourceKeyIds: Object.freeze(['A', 'B']),
    repeat: 2,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 10,
    originalEndExclusive: 16,
    visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 16 })]),
    frameOverrides: Object.freeze([]),
    ...overrides,
  });
}

describe('useRotoTimelineActions selection-scoped Delete activation', () => {
  const records = [realKeyRecord('A', 0), realKeyRecord('B', 3), realKeyRecord('ordinary', 20)];

  it('classifies Group-owned occurrences as Delete Frame unless the complete Group Rail is selected', () => {
    const group = lifecycleGroup({
      frameOverrides: Object.freeze([Object.freeze({ appFrame: 15, keyId: 'override-15' })]),
    });
    const groupRecords = [...records, realKeyRecord('override-15', 15)];
    const base = {
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedLoopClipIds: [] as readonly string[],
      capacity: 30,
      records: groupRecords,
      loopClips: [group],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    };

    for (const appFrame of [10, 11, 15]) {
      expect(classifyRotoDeleteTarget({ ...base, currentAppFrame: appFrame })).toEqual({
        kind: 'group-frame',
        groupId: 'group-1',
        appFrame,
        mode: 'progressive',
        phaseOrigin: 10,
        onlyOccurrence: false,
      });
    }

    expect(classifyRotoDeleteTarget({
      ...base,
      currentAppFrame: 20,
      selectedLoopClipIds: ['group-1'],
    })).toEqual({
      kind: 'group',
      groupId: 'group-1',
      appFrame: 10,
      mode: 'progressive',
      phaseOrigin: 10,
      onlyOccurrence: false,
    });
  });

  it('classifies an exact derived Key Rail before ordinary multi-key Delete while physical selection remains authoritative', () => {
    const railRecords = [
      realKeyRecord('rail-a', 2),
      realKeyRecord('rail-b', 5),
      realKeyRecord('next-rail', 9),
    ];
    const base = {
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: ['rail-a', 'rail-b'] as readonly string[],
      selectedKeyRail: { firstKeyId: 'rail-a', keyIds: ['rail-a', 'rail-b'] as readonly string[] },
      selectedLoopClipIds: [] as readonly string[],
      currentAppFrame: 5,
      capacity: 20,
      records: railRecords,
      loopClips: [] as readonly PhysicPaintRotoLoopClip[],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      incomingInterpolationBreakKeyIds: ['next-rail'] as readonly string[],
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    };

    expect(classifyRotoDeleteTarget(base)).toEqual({
      kind: 'key-rail',
      firstKeyId: 'rail-a',
      keyIds: ['rail-a', 'rail-b'],
      firstKeyFrame: 2,
      lastKeyFrame: 5,
    });
    expect(classifyRotoDeleteTarget({
      ...base,
      selectedKeyId: 'rail-b',
      selectedKeyIds: ['rail-b'],
    })).toEqual({ kind: 'ordinary-key', keyId: 'rail-b' });
    expect(classifyRotoDeleteTarget({
      ...base,
      selectedKeyRail: null,
    })).toEqual({ kind: 'ordinary-key-group', keyIds: ['rail-a', 'rail-b'] });
  });

  it('fails closed when a selected Key Rail no longer matches the accepted derivation', () => {
    const target = classifyRotoDeleteTarget({
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedKeyRail: { firstKeyId: 'rail-a', keyIds: ['rail-a', 'stale-member'] },
      selectedLoopClipIds: [] as readonly string[],
      currentAppFrame: 5,
      capacity: 20,
      records: [realKeyRecord('rail-a', 2), realKeyRecord('rail-b', 5)],
      loopClips: [] as readonly PhysicPaintRotoLoopClip[],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      incomingInterpolationBreakKeyIds: [] as readonly string[],
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    });

    expect(target).toEqual({ kind: 'stale-key-rail' });
    expect(mapRotoDeleteProductReason(target)).toBe('The selected Key Rail is no longer available.');
  });

  it('preserves ordinary single-key and multi-key Delete while mapping every non-deletable target once', () => {
    const base = {
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedLoopClipIds: [] as readonly string[],
      currentAppFrame: 20,
      capacity: 30,
      records,
      loopClips: [] as readonly PhysicPaintRotoLoopClip[],
      interpolation: { enabled: false, mode: 'duplicate' as const },
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    };
    expect(classifyRotoDeleteTarget({ ...base, selectedKeyId: 'ordinary' })).toEqual({
      kind: 'ordinary-key',
      keyId: 'ordinary',
    });
    expect(classifyRotoDeleteTarget({ ...base, selectedKeyIds: ['A', 'B'] })).toEqual({
      kind: 'ordinary-key-group',
      keyIds: ['A', 'B'],
    });

    const cases: readonly [RotoDeleteTarget, string][] = [
      [{ kind: 'group-gap', groupId: 'group-1', appFrame: 12 }, 'Delete is unavailable on an intentional Group gap.'],
      [{ kind: 'unresolved-group', groupId: 'group-1', appFrame: 12 }, 'Delete is unavailable because this Group frame cannot be resolved.'],
      [{ kind: 'ambiguous-group', appFrame: 12 }, 'Delete is unavailable because more than one Group owns this frame.'],
      [{ kind: 'generated', appFrame: 12 }, 'Delete is unavailable on a generated render-only frame.'],
      [{ kind: 'no-target' }, 'Select a real Roto key or Group frame to delete.'],
      [{ kind: 'edit-in-flight' }, 'A Roto physical edit is already in flight.'],
      [{ kind: 'unavailable' }, 'Select a Physics Paint Roto timeline before deleting.'],
    ];
    for (const [target, reason] of cases) expect(mapRotoDeleteProductReason(target)).toBe(reason);
  });

  it('dispatches Delete Frame directly for an individual Group-owned physical frame without opening a choice modal', async () => {
    let currentAppFrame = 10;
    const getCurrentAppFrame = vi.fn(() => currentAppFrame);
    const executeGroupLifecycleDelete = vi.fn(async () => true);
    const requestGroupDeleteChoice = vi.fn();
    const harness = createHarness({
      records,
      loopClips: [lifecycleGroup()],
      capacity: 30,
      getCurrentAppFrame,
      executeGroupLifecycleDelete,
      requestGroupDeleteChoice,
    });

    currentAppFrame = 11;
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(getCurrentAppFrame).toHaveBeenCalledTimes(1);
    expect(executeGroupLifecycleDelete).toHaveBeenCalledWith({
      operationKind: 'delete-group-frame',
      groupId: 'group-1',
      appFrame: 11,
      phaseOrigin: 10,
      onlyOccurrence: false,
    });
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    expect(harness.publishStatus).not.toHaveBeenCalled();
  });

  it('dispatches Delete Group directly from Group Rail selection without moving or reclassifying the cursor frame', async () => {
    const executeGroupLifecycleDelete = vi.fn(async () => true);
    const requestGroupDeleteChoice = vi.fn();
    const harness = createHarness({
      records,
      loopClips: [lifecycleGroup()],
      selectedLoopClipIds: ['group-1'],
      selectedLoopRailDisplayName: 'Walk Group',
      currentAppFrame: 20,
      capacity: 30,
      executeGroupLifecycleDelete,
      requestGroupDeleteChoice,
    });

    expect(harness.actions.physicalActions.deleteScopeLabel.value).toBe('Delete Motion Rail — Walk Group');
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(executeGroupLifecycleDelete).toHaveBeenCalledWith({
      operationKind: 'delete-group',
      groupId: 'group-1',
      appFrame: 10,
      phaseOrigin: 10,
      onlyOccurrence: false,
    });
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('opens only the focused sole-occurrence Delete Frame warning', async () => {
    const executeGroupLifecycleDelete = vi.fn(async () => true);
    const requestSoleOccurrenceDeleteWarning = vi.fn();
    const requestGroupDeleteChoice = vi.fn();
    const harness = createHarness({
      records: [realKeyRecord('A', 0)],
      loopClips: [lifecycleGroup({
        sourceKeyIds: Object.freeze(['A']),
        repeat: 1,
        originalEndExclusive: 11,
        visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 11 })]),
      })],
      currentAppFrame: 10,
      capacity: 30,
      executeGroupLifecycleDelete,
      requestSoleOccurrenceDeleteWarning,
      requestGroupDeleteChoice,
    });

    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(false);
    expect(requestSoleOccurrenceDeleteWarning).toHaveBeenCalledWith({
      operationKind: 'delete-group-frame',
      groupId: 'group-1',
      appFrame: 10,
      phaseOrigin: 10,
      onlyOccurrence: true,
    });
    expect(executeGroupLifecycleDelete).not.toHaveBeenCalled();
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
  });

  it('leaves a rejected direct Group command immediately reusable without resetting selection or opening a modal', async () => {
    const executeGroupLifecycleDelete = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const requestGroupDeleteChoice = vi.fn();
    const harness = createHarness({
      records,
      loopClips: [lifecycleGroup()],
      selectedLoopClipIds: ['group-1'],
      currentAppFrame: 20,
      capacity: 30,
      executeGroupLifecycleDelete,
      requestGroupDeleteChoice,
    });

    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(false);
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(executeGroupLifecycleDelete).toHaveBeenCalledTimes(2);
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
    expect(harness.pendingOperationId.value).toBeNull();
  });

  it('deletes exact multiple-key and single-key rails with the locked acceptance copy', async () => {
    const multiple = createHarness({
      records: [
        realKeyRecord('rail-a', 2),
        realKeyRecord('rail-b', 5),
        realKeyRecord('next-rail', 9),
      ],
      selectedKeyRail: { firstKeyId: 'rail-a', keyIds: ['rail-a', 'rail-b'] },
      incomingInterpolationBreakKeyIds: ['next-rail'],
      currentAppFrame: 5,
      capacity: 20,
      parentEndExclusive: 20,
    });

    expect(multiple.actions.physicalActions.deleteScopeLabel.value).toBe('Delete Key Rail — frames 2–5, 2 keys.');
    expect(await multiple.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(multiple.executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'delete-key-rail',
      intent: { kind: 'delete-key-rail', keyIds: ['rail-a', 'rail-b'] },
    }));
    expect(multiple.publishStatus).toHaveBeenCalledWith(
      'Deleted Key Rail — frames 2–5, 2 keys. The interval stays an intentional gap.',
    );

    const single = createHarness({
      records: [realKeyRecord('only-rail', 4)],
      selectedKeyRail: { firstKeyId: 'only-rail', keyIds: ['only-rail'] },
      currentAppFrame: 4,
      capacity: 20,
      parentEndExclusive: 20,
    });

    expect(single.actions.physicalActions.deleteScopeLabel.value).toBe('Delete Key Rail — frame 4, 1 key.');
    expect(await single.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(single.executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'delete-key-rail',
      intent: { kind: 'delete-key-rail', keyIds: ['only-rail'] },
    }));
    expect(single.publishStatus).toHaveBeenCalledWith(
      'Deleted Key Rail — frame 4, 1 key. The interval stays an intentional gap.',
    );
  });

  it('rejects stale Key Rail selection before mutation or success publication', async () => {
    const harness = createHarness({
      records: [realKeyRecord('rail-a', 2), realKeyRecord('rail-b', 5)],
      selectedKeyRail: { firstKeyId: 'rail-a', keyIds: ['rail-a', 'stale-member'] },
      currentAppFrame: 5,
      capacity: 20,
    });

    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(false);
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    expect(harness.publishStatus).toHaveBeenCalledTimes(1);
    expect(harness.publishStatus).toHaveBeenCalledWith('The selected Key Rail is no longer available.');
  });

  it('keeps ordinary-key deletion on the existing physical edit path', async () => {
    const executeGroupLifecycleDelete = vi.fn(async () => true);
    const harness = createHarness({
      records,
      selectedKeyId: 'ordinary',
      currentAppFrame: 20,
      capacity: 30,
      executeGroupLifecycleDelete,
    });

    expect(harness.actions.physicalActions.deleteScopeLabel.value).toBe('Delete Frame');
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(harness.executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'delete-key',
      intent: { kind: 'delete-key', selectedKeyId: 'ordinary' },
    }));
    expect(executeGroupLifecycleDelete).not.toHaveBeenCalled();
  });

  it('reclassifies stale Group ownership and publishes one canonical reason without opening a warning or dialog', async () => {
    const requestSoleOccurrenceDeleteWarning = vi.fn();
    const requestGroupDeleteChoice = vi.fn();
    const harness = createHarness({
      records,
      loopClips: [lifecycleGroup({ visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 11 })]) })],
      currentAppFrame: 12,
      capacity: 30,
      requestSoleOccurrenceDeleteWarning,
      requestGroupDeleteChoice,
    });

    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(false);
    expect(requestSoleOccurrenceDeleteWarning).not.toHaveBeenCalled();
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    expect(harness.publishStatus).toHaveBeenCalledTimes(1);
    expect(harness.publishStatus).toHaveBeenCalledWith('Delete is unavailable on an intentional Group gap.');
  });
});

describe('useRotoTimelineActions contextual Insert', () => {
  it('context-dispatches occupied and genuinely empty Insert targets', async () => {
    const occupied = createHarness({
      records: [realKeyRecord('key-a', 3)],
      selectedKeyId: 'key-a',
      currentAppFrame: 3,
      physicalCells: [{ kind: 'real', appFrame: 3, keyId: 'key-a' }],
    });

    expect(occupied.actions.physicalActions.canInsertFrame.value).toBe(true);
    expect(occupied.actions.physicalActions.insertTooltipDescription.value).toBe('Insert key before');
    expect(await occupied.actions.physicalActions.insertRotoFrame()).toBe(true);
    expect(occupied.executePhysicalEdit).toHaveBeenCalledTimes(1);
    expect(occupied.executePhysicalEdit.mock.calls[0][0]).toMatchObject({
      operationKind: 'insert-slot',
      intent: { kind: 'insert-slot', selectedKeyId: 'key-a' },
    });
    expect(occupied.publishStatus).toHaveBeenCalledWith('Inserted an empty Roto frame before the selected key.');

    const predecessorDataUrl = 'data:image/png;base64,iVBORw0KGgoAAA==';
    const records = [
      Object.freeze({
        ...realKeyRecord('key-before', 1),
        payload: Object.freeze({ ...blankPayload(1), dataUrl: predecessorDataUrl }),
      }) as PhysicPaintRotoRealKeyRecord,
      realKeyRecord('key-after', 5),
    ];
    const empty = createHarness({
      records,
      currentAppFrame: 3,
      physicalCells: [
        { kind: 'empty', appFrame: 0 },
        { kind: 'real', appFrame: 1, keyId: 'key-before' },
        { kind: 'empty', appFrame: 2 },
        { kind: 'empty', appFrame: 3 },
      ],
      incomingInterpolationBreakKeyIds: ['key-after'],
    });

    expect(empty.actions.physicalActions.canInsertFrame.value).toBe(true);
    expect(empty.actions.physicalActions.insertTooltipDescription.value).toBe(
      'Insert an empty key and start a new interpolation segment.',
    );
    const emptyAccepted = await empty.actions.physicalActions.insertRotoFrame();
    expect(emptyAccepted, JSON.stringify({ status: empty.publishStatus.mock.calls, diagnostic: empty.publishDiagnostic.mock.calls })).toBe(true);
    expect(empty.executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = empty.executePhysicalEdit.mock.calls[0][0] as unknown as {
      operationKind: string;
      proposal: {
        selectedKeyId: string;
        selectedAppFrame: number;
        nextRecords: readonly PhysicPaintRotoRealKeyRecord[];
        nextIncomingInterpolationBreakKeyIds: readonly string[];
      };
    };
    expect(dispatched.operationKind).toBe('insert-empty-segment');
    expect(dispatched.proposal.selectedAppFrame).toBe(3);
    expect(dispatched.proposal.nextRecords).toHaveLength(3);
    const inserted = dispatched.proposal.nextRecords.find((record) => record.keyId === dispatched.proposal.selectedKeyId);
    expect(inserted?.payload.dataUrl).toBe(BLANK_PNG_DATA_URL);
    expect(inserted?.payload.dataUrl).not.toBe(predecessorDataUrl);
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([
      'key-after',
      dispatched.proposal.selectedKeyId,
    ]);
  });

  it('publishes the exact empty-segment acceptance message', async () => {
    const { actions, publishStatus } = createHarness({
      records: [realKeyRecord('key-a', 1), realKeyRecord('key-b', 5)],
      currentAppFrame: 3,
      physicalCells: [{ kind: 'empty', appFrame: 3 }],
    });

    expect(await actions.physicalActions.insertRotoFrame()).toBe(true);
    expect(publishStatus).toHaveBeenCalledTimes(1);
    expect(publishStatus).toHaveBeenCalledWith(
      'Inserted empty key at frame 3. New interpolation segment started.',
    );
  });

  it('uses identical target-specific copy for disabled and racing rejection', async () => {
    const cases: readonly [RotoInsertTarget, string][] = [
      [{ kind: 'generated', appFrame: 3 }, 'Insert is unavailable on a generated render-only frame.'],
      [{ kind: 'resolved-linked', appFrame: 3 }, 'Insert is unavailable on a resolved linked frame.'],
      [{ kind: 'unresolved-linked', appFrame: 3 }, 'Insert is unavailable on an unresolved linked frame.'],
      [{ kind: 'occupied-empty-intent', appFrame: 3 }, 'This frame already contains a real key.'],
      [{ kind: 'invalid-destination' }, 'Choose a valid timeline frame before inserting.'],
      [{ kind: 'out-of-capacity', appFrame: 10 }, 'This frame is outside the physical timeline capacity.'],
      [{ kind: 'edit-in-flight' }, 'A Roto physical edit is already in flight.'],
    ];
    for (const [target, expected] of cases) {
      expect(mapRotoInsertProductReason(target)).toBe(expected);
    }

    expect(classifyRotoInsertTarget({
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      currentAppFrame: 3,
      capacity: 10,
      records: [],
      physicalCells: [{ kind: 'empty', appFrame: 0 }, { kind: 'empty', appFrame: 1 }, { kind: 'empty', appFrame: 2 }, {
        kind: 'generated', appFrame: 3, leftKeyId: 'left', rightKeyId: 'right',
      }],
      frameResolution: { kind: 'empty' },
    })).toEqual({ kind: 'generated', appFrame: 3 });

    const disabledHarnesses = [
      createHarness({
        currentAppFrame: 3,
        physicalCells: [{ kind: 'empty', appFrame: 0 }, { kind: 'empty', appFrame: 1 }, { kind: 'empty', appFrame: 2 }, {
          kind: 'generated', appFrame: 3, leftKeyId: 'left', rightKeyId: 'right',
        }],
      }),
      createHarness({
        currentAppFrame: 3,
        frameResolution: {
          kind: 'linked', loopId: 'loop', appFrame: 3, sourceKeyId: 'source', sourceIndex: 0, cycleOffset: 0, repeatInstance: 1,
        },
      }),
      createHarness({
        currentAppFrame: 3,
        frameResolution: {
          kind: 'linked-unresolved', loopId: 'loop', appFrame: 3, placementStart: 2, sourceKeyIds: ['missing'], missingSourceKeyIds: ['missing'],
        },
      }),
      createHarness({ records: [realKeyRecord('occupied', 3)], currentAppFrame: 3 }),
      createHarness({ currentAppFrame: -1 }),
      createHarness({ currentAppFrame: 10, capacity: 10 }),
    ];
    for (let index = 0; index < disabledHarnesses.length; index += 1) {
      const harness = disabledHarnesses[index];
      const expected = cases[index][1];
      expect(harness.actions.physicalActions.canInsertFrame.value).toBe(false);
      expect(harness.actions.physicalActions.insertDisabledReason.value).toBe(expected);
      expect(await harness.actions.physicalActions.insertRotoFrame()).toBe(false);
      expect(harness.publishStatus).toHaveBeenCalledWith(expected);
      expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    }

    const busyRace = createHarness({ currentAppFrame: 3, physicalCells: [{ kind: 'empty', appFrame: 3 }] });
    expect(busyRace.actions.physicalActions.canInsertFrame.value).toBe(true);
    busyRace.pendingOperationId.value = 'op-race';
    expect(await busyRace.actions.physicalActions.insertRotoFrame()).toBe(false);
    expect(busyRace.publishStatus).toHaveBeenCalledWith(cases[6][1]);
    expect(busyRace.executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions + Key (addEmptyKey) port', () => {
  it('exposes reactive availability that is eligible on an unoccupied current frame', () => {
    const { actions } = createHarness({ records: [realKeyRecord('key-a', 1)], currentAppFrame: 3 });
    expect(actions.physicalActions.canAddEmptyKey.value).toBe(true);
    expect(actions.physicalActions.addEmptyKeyDisabledReason.value).toBeNull();
  });

  it('is unavailable with a verbatim reason when the current frame already has a real key', () => {
    const { actions } = createHarness({ records: [realKeyRecord('key-a', 3)], currentAppFrame: 3 });
    expect(actions.physicalActions.canAddEmptyKey.value).toBe(false);
    expect(actions.physicalActions.addEmptyKeyDisabledReason.value).toBe('The current frame already has a real Roto key.');
  });

  it('is unavailable with a verbatim reason without a launch context or while an edit is in flight', () => {
    const noLaunch = createHarness({ launch: null });
    expect(noLaunch.actions.physicalActions.canAddEmptyKey.value).toBe(false);
    expect(noLaunch.actions.physicalActions.addEmptyKeyDisabledReason.value).toBe('Select a Physics Paint Roto timeline before adding a key.');

    const pending = createHarness({ pendingOperationId: 'op-busy' });
    expect(pending.actions.physicalActions.canAddEmptyKey.value).toBe(false);
    expect(pending.actions.physicalActions.addEmptyKeyDisabledReason.value).toBe('A Roto physical edit is already in flight.');
  });

  it('creates a real key at the destination frame with the supplied empty payload', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({ records: [], currentAppFrame: 3 });
    const accepted = await actions.physicalKeyUtilities.addEmptyKey(3, blankPayload(3));
    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        mapping: ReadonlyMap<string, number>;
        selectedAppFrame: number | null;
        nextRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
      };
      operationKind: string;
    };
    expect(dispatched.operationKind).toBe('paste-key');
    expect(dispatched.proposal.mapping.size).toBe(1);
    const [newKeyId] = dispatched.proposal.mapping.keys();
    expect(dispatched.proposal.mapping.get(newKeyId)).toBe(3);
    expect(dispatched.proposal.selectedAppFrame).toBe(3);
    expect(dispatched.proposal.nextRecords).toHaveLength(1);
    expect(dispatched.proposal.nextRecords?.[0].payload.dataUrl).toBe(BLANK_PNG_DATA_URL);
    expect(publishStatus).toHaveBeenCalledWith('Added an empty Roto key.');
  });

  it('rejects an occupied destination through the resolver without dispatching', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: [realKeyRecord('key-a', 3)],
      currentAppFrame: 3,
    });
    const accepted = await actions.physicalKeyUtilities.addEmptyKey(3, blankPayload(3));
    expect(accepted).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Paste-to-empty destination is occupied.');
  });
});

describe('useRotoTimelineActions linked source-position Force Spacing', () => {
  const linkedRecords = [
    realKeyRecord('A', 10),
    realKeyRecord('B', 12),
    realKeyRecord('C', 15),
    realKeyRecord('D', 20),
    realKeyRecord('E', 24),
  ];

  it('rejects one proxy position without resolver execution, fallback, or publication', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: linkedRecords,
      loopClips: [linkedLoop],
      spacingSelection: spacingSelection(['B']),
      capacity: 100,
    });

    const accepted = await actions.physicalActions.applyForceSpacing();

    expect(accepted).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Select at least two Loop Clip source positions to apply Key Spacing.');
  });

  it('scopes exactly the valid proxy source IDs with immutable provenance and executes one physical edit', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: linkedRecords,
      loopClips: [linkedLoop],
      spacingSelection: spacingSelection(['B', 'D']),
      capacity: 100,
    });
    actions.physicalActions.setForceSpacingInput('5');

    const accepted = await actions.physicalActions.applyForceSpacing();

    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: { mapping: ReadonlyMap<string, number>; nextLoopClips: unknown };
      operationKind: string;
      intent: unknown;
    };
    expect(dispatched.operationKind).toBe('force-spacing');
    expect(dispatched.intent).toEqual({
      kind: 'force-spacing',
      emptyFrames: 5,
      selectedKeyId: null,
      scopeKeyIds: ['B', 'D'],
      linkedSourceSpacingScopes: [{
        sourceCycleId: getPhysicsPaintRotoSourceCycleId(['A', 'B', 'C', 'D', 'E']),
        sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
        selectedSourceKeyIds: ['B', 'D'],
      }],
    });
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 10, B: 12, C: 15, D: 18, E: 22 });
    expect(dispatched.proposal.nextLoopClips).toBeNull();
  });

  it('preserves the ordinary no-proxy full-timeline path exactly', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 3), realKeyRecord('C', 8)],
      spacingSelection: null,
      capacity: 20,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as { proposal: { mapping: ReadonlyMap<string, number> } };
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 2, C: 4 });
  });

  it('restores ordinary Force Spacing fallback after the final proxy is toggled off', async () => {
    const selected = spacingSelection(['B']);
    const cleared = togglePhysicsPaintRotoSpacingProxy(selected, {
      loopId: 'loop-shared',
      sourceCycleId: selected.sourceCycleId,
      sourceKeyIds: selected.sourceKeyIds,
      sourceKeyId: 'B',
      sourceIndex: 1,
    });
    expect(cleared).toBeNull();
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 3), realKeyRecord('C', 8)],
      spacingSelection: cleared,
      capacity: 20,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as { proposal: { mapping: ReadonlyMap<string, number> } };
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 2, C: 4 });
  });
});

describe('useRotoTimelineActions rail-owned multi-capsule Force Spacing', () => {
  const records = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 1),
    realKeyRecord('C', 2),
    realKeyRecord('X', 6),
    realKeyRecord('Y', 7),
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

  it('derives complete selected rail cycles and processes them left-to-right', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records,
      loopClips,
      selectedLoopClipIds: ['loop-a', 'loop-b'],
      capacity: 30,
    });
    actions.physicalActions.setForceSpacingInput('2');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        mapping: ReadonlyMap<string, number>;
        nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null;
      };
    };
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 3, C: 6, X: 10, Y: 13 });
    expect(dispatched.proposal.nextLoopClips?.find((clip) => clip.loopId === 'loop-b')?.placementStart).toBe(10);
  });

  it.each([
    { emptyFrames: 2, mappedFrames: { A: 10, B: 13, C: 16 }, cycleLength: 7, endExclusive: 31, width: 378 },
    { emptyFrames: 3, mappedFrames: { A: 10, B: 14, C: 18 }, cycleLength: 9, endExclusive: 37, width: 486 },
  ])('rebuilds complete Repeat 3 lifecycle and rail geometry for Group spacing $emptyFrames', async ({
    emptyFrames,
    mappedFrames,
    cycleLength,
    endExclusive,
    width,
  }) => {
    const sourceRecords = [
      realKeyRecord('A', 10),
      realKeyRecord('B', 11),
      realKeyRecord('C', 12),
    ];
    const group = spacingLifecycleGroup();
    const { actions, executePhysicalEdit } = createHarness({
      records: sourceRecords,
      loopClips: [group],
      selectedLoopClipIds: [group.loopId],
      capacity: 100,
    });
    actions.physicalActions.setForceSpacingInput(String(emptyFrames));

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        mapping: ReadonlyMap<string, number>;
        nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null;
      };
    };
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual(mappedFrames);
    expect(dispatched.proposal.nextLoopClips).toEqual([{
      ...group,
      phaseOrigin: 10,
      originalEndExclusive: endExclusive,
      visibleRanges: [{ start: 10, endExclusive }],
    }]);

    const mappedRecords = sourceRecords.map((entry) => {
      const appFrame = dispatched.proposal.mapping.get(entry.keyId) ?? entry.appFrame;
      return { ...entry, appFrame, payload: { ...entry.payload, appFrame } };
    });
    const ranges = derivePhysicPaintRotoLoopRanges({
      identities: mappedRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      loopClips: dispatched.proposal.nextLoopClips ?? [group],
      capacity: 100,
      interpolationEnabled: false,
    }).ranges;
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      loopId: group.loopId,
      placementStart: 10,
      phaseOrigin: 10,
      cycleLength,
      repeat: 3,
      requestedEnd: endExclusive,
      effectiveEnd: endExclusive,
      partialCycle: false,
    });
    expect(projectPhysicsPaintLoopClipGeometry(
      ranges[0],
      { startFrame: 0, endFrameExclusive: 100 },
      18,
    )).toEqual({ left: 180, width });
  });

  it('deduplicates identical shared source cycles selected through non-contiguous rails', async () => {
    const sharedClips: readonly PhysicPaintRotoLoopClip[] = [
      loopClips[0],
      { ...loopClips[0], loopId: 'loop-shared', placementStart: 20 },
    ];
    const { actions, executePhysicalEdit } = createHarness({
      records: records.slice(0, 3),
      loopClips: sharedClips,
      selectedLoopClipIds: ['loop-a', 'loop-shared'],
      capacity: 30,
    });
    actions.physicalActions.setForceSpacingInput('2');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: { mapping: ReadonlyMap<string, number>; nextLoopClips: readonly PhysicPaintRotoLoopClip[] | null };
    };
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 3, C: 6 });
    expect(dispatched.proposal.nextLoopClips).toBeNull();
  });

  it('rejects physical selection spanning more than one linked source cycle with rail guidance', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records,
      loopClips,
      selectedKeyIds: ['A', 'X'],
      capacity: 30,
    });

    expect(await actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Select Loop Rails to apply Key Spacing across multiple Loop Clips.');
  });

  it('rejects reordered rail selection and stale hidden proxy authorization before resolver execution', async () => {
    const reordered = createHarness({
      records,
      loopClips,
      selectedLoopClipIds: ['loop-b', 'loop-a'],
      capacity: 30,
    });
    expect(await reordered.actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(reordered.executePhysicalEdit).not.toHaveBeenCalled();
    expect(reordered.publishStatus).toHaveBeenCalledWith('Loop Rail selection is stale. Select the Loop Rails again.');

    const staleProxy = createHarness({
      records,
      loopClips,
      spacingSelection: spacingSelection(['A', 'B']),
      selectedKeyIds: ['A', 'B', 'C', 'X', 'Y'],
      capacity: 30,
    });
    expect(await staleProxy.actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(staleProxy.executePhysicalEdit).not.toHaveBeenCalled();
    expect(staleProxy.publishStatus).toHaveBeenCalledWith('Physical Key Spacing selection is stale. Select the keys again.');
  });
});

describe('useRotoTimelineActions Key Rail Force Spacing (43.4 defect 2)', () => {
  const railRecords = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 1),
    realKeyRecord('C', 2),
  ];

  it('spaces a rail-only selection rigidly through the canonical edit path', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: railRecords,
      selectedKeyRail: { firstKeyId: 'A', keyIds: ['A', 'B', 'C'] as readonly string[] },
      capacity: 30,
    });
    actions.physicalActions.setForceSpacingInput('2');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      operationKind: string;
      intent: { scopeKeyIds: readonly string[] | null };
      proposal: { mapping: ReadonlyMap<string, number> };
    };
    expect(dispatched.operationKind).toBe('force-spacing');
    expect(dispatched.intent.scopeKeyIds).toEqual(['A', 'B', 'C']);
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 3, C: 6 });
  });

  it('rejects a conflicting physical key selection alongside a Key Rail selection', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: railRecords,
      selectedKeyRail: { firstKeyId: 'A', keyIds: ['A', 'B', 'C'] as readonly string[] },
      selectedKeyIds: ['A'],
      capacity: 30,
    });
    actions.physicalActions.setForceSpacingInput('2');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Rail and physical Key Spacing selections conflict. Select the Loop Rails again.');
  });
});

describe('useRotoTimelineActions rigid group-drag settlement', () => {
  it('commits the exact retained A@5/B@6/D@7 proposal once', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [
        realKeyRecord('A', 0),
        realKeyRecord('B', 1),
        realKeyRecord('D', 7),
      ],
      selectedKeyIds: ['A', 'B'],
    });

    const preparation = actions.physicalActions.prepareRotoKeyGroupDrag('B', {
      kind: 'physical-cell',
      appFrame: 6,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Rigid group drag must prepare');
    expect(Object.fromEntries(preparation.publication.proposal.mapping)).toEqual({ A: 5, B: 6, D: 7 });

    const accepted = await actions.physicalActions.commitRotoKeyGroupDrag(preparation.publication);

    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: unknown;
      operationKind: string;
      intent: unknown;
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.operationKind).toBe('move-key-group');
    expect(dispatched.intent).toEqual({
      kind: 'move-key-group',
      movedKeyIds: ['A', 'B'],
      grabbedKeyId: 'B',
      target: { kind: 'physical-cell', appFrame: 6 },
    });
    expect(dispatched.selectedKeyId).toBe('B');
    expect(dispatched.selectedAppFrame).toBe(6);
  });

  it('retains resolver conflicts and never dispatches a rejected group drag', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [
        realKeyRecord('A', 0),
        realKeyRecord('B', 1),
        realKeyRecord('D', 7),
      ],
      selectedKeyIds: ['A', 'B'],
    });

    const preparation = actions.physicalActions.prepareRotoKeyGroupDrag('B', {
      kind: 'physical-cell',
      appFrame: 7,
    });

    expect(preparation.ok).toBe(false);
    if (preparation.ok) throw new Error('Colliding group drag must reject');
    expect(preparation.reason).toBe('Move rejected — key in the way');
    expect(preparation.conflictingAppFrames).toEqual([7]);
    expect(preparation.detail).toContain('occupied by an unselected real key');
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions Key Rail drag prepare/commit publication pair', () => {
  const railRecords = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 3),
    realKeyRecord('C', 6),
    realKeyRecord('D', 10),
  ];

  it('rejects in the same launch, ports, then in-flight guard order as Group drag', () => {
    const noLaunch = createHarness({ launch: null, records: railRecords, capacity: 16 });
    expect(noLaunch.actions.physicalActions.prepareKeyRailDrag('A', 3)).toEqual({
      ok: false,
      reason: 'Select a real Roto key before editing the timeline.',
    });

    const noPorts = createHarness({ records: railRecords, capacity: 16, omitPhysicalEditPorts: true });
    expect(noPorts.actions.physicalActions.prepareKeyRailDrag('A', 3)).toEqual({
      ok: false,
      reason: 'Timeline editing is unavailable.',
    });

    const inFlight = createHarness({ records: railRecords, capacity: 16, pendingOperationId: 'op-busy' });
    expect(inFlight.actions.physicalActions.prepareKeyRailDrag('A', 3)).toEqual({
      ok: false,
      reason: 'A Roto physical edit is already in flight.',
    });
  });

  it('threads break authority into the resolver and exported proposal-version fingerprint', () => {
    const base = { records: railRecords, capacity: 16 };
    const withoutBreaks = createHarness({ ...base, incomingInterpolationBreakKeyIds: [] });
    const withFirstKeyBreak = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['A'] });

    const plain = withoutBreaks.actions.physicalActions.prepareKeyRailDrag('A', 3);
    const broken = withFirstKeyBreak.actions.physicalActions.prepareKeyRailDrag('A', 3);

    expect(plain.ok).toBe(true);
    expect(broken.ok).toBe(true);
    if (!plain.ok || !broken.ok) throw new Error('Both Key Rail preparations must succeed');
    expect(plain.publication.proposalVersion).not.toBe(broken.publication.proposalVersion);
    expect(Object.isFrozen(plain.publication)).toBe(true);
    expect(Object.isFrozen(plain.publication.memberKeyIds)).toBe(true);
    expect(plain.publication.memberKeyIds).toEqual(['A', 'B', 'C', 'D']);

    expect(buildKeyRailDragProposalVersion(
      railRecords,
      { enabled: false, mode: 'duplicate' },
      [],
      [],
      { operationId: 'op-1', layerId: 'layer-1', startFrame: 0 },
    )).not.toBe(buildKeyRailDragProposalVersion(
      railRecords,
      { enabled: false, mode: 'duplicate' },
      [],
      ['A'],
      { operationId: 'op-1', layerId: 'layer-1', startFrame: 0 },
    ));

    const invalidBreak = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['unknown-break'] });
    const rejected = invalidBreak.actions.physicalActions.prepareKeyRailDrag('A', 3);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Invalid break authority must reject');
    expect(rejected.detail).toContain('does not exist');
  });

  it('rejects a no-change destination at prepare with no publication', () => {
    const { actions, executePhysicalEdit } = createHarness({ records: railRecords, capacity: 16 });
    const preparation = actions.physicalActions.prepareKeyRailDrag('A', 0);

    expect(preparation.ok).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('rejects incoherent publications and every stale structural authority silently', async () => {
    const incoherent = createHarness({ records: railRecords, capacity: 16 });
    const preparation = incoherent.actions.physicalActions.prepareKeyRailDrag('A', 3);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Key Rail drag must prepare');
    const publication = preparation.publication;

    const kindMismatch = {
      ...publication,
      proposal: {
        ...publication.proposal,
        status: { ...publication.proposal.status, operationKind: 'move-key-group' as const },
      },
    };
    const intentMismatch = {
      ...publication,
      intent: { kind: 'move-group', loopId: 'group-1', destinationPlacementStart: 3 },
    };
    const firstKeyMismatch = { ...publication, firstKeyId: 'B' };
    const memberMismatch = { ...publication, memberKeyIds: Object.freeze(['A', 'C']) };
    const emptyLaunch = { ...publication, expectedLaunch: { operationId: '', layerId: '' } };

    expect(await incoherent.actions.physicalActions.commitKeyRailDrag(kindMismatch as never)).toBe(false);
    expect(await incoherent.actions.physicalActions.commitKeyRailDrag(intentMismatch as never)).toBe(false);
    expect(await incoherent.actions.physicalActions.commitKeyRailDrag(firstKeyMismatch)).toBe(false);
    expect(await incoherent.actions.physicalActions.commitKeyRailDrag(memberMismatch)).toBe(false);
    expect(await incoherent.actions.physicalActions.commitKeyRailDrag(emptyLaunch)).toBe(false);
    expect(incoherent.executePhysicalEdit).not.toHaveBeenCalled();
    expect(incoherent.publishStatus).not.toHaveBeenCalled();

    const mutableRecords = [...railRecords];
    const staleRecords = createHarness({ records: mutableRecords, capacity: 16 });
    const recordsPublication = staleRecords.actions.physicalActions.prepareKeyRailDrag('A', 3);
    if (!recordsPublication.ok) throw new Error('Records publication must prepare');
    mutableRecords.push(realKeyRecord('E', 14));
    expect(await staleRecords.actions.physicalActions.commitKeyRailDrag(recordsPublication.publication)).toBe(false);

    let interpolation: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };
    const staleInterpolation = createHarness({
      records: railRecords,
      capacity: 16,
      getRotoInterpolationState: () => interpolation,
    });
    const interpolationPublication = staleInterpolation.actions.physicalActions.prepareKeyRailDrag('A', 3);
    if (!interpolationPublication.ok) throw new Error('Interpolation publication must prepare');
    interpolation = { enabled: true, mode: 'duplicate' };
    expect(await staleInterpolation.actions.physicalActions.commitKeyRailDrag(interpolationPublication.publication)).toBe(false);

    let loopClips: readonly PhysicPaintRotoLoopClip[] = [];
    const staleLoops = createHarness({ records: railRecords, capacity: 16, getRotoLoopClips: () => loopClips });
    const loopsPublication = staleLoops.actions.physicalActions.prepareKeyRailDrag('A', 3);
    if (!loopsPublication.ok) throw new Error('Loop publication must prepare');
    loopClips = [lifecycleGroup({ loopId: 'new-group', placementStart: 12, sourceKeyIds: Object.freeze(['E']) })];
    expect(await staleLoops.actions.physicalActions.commitKeyRailDrag(loopsPublication.publication)).toBe(false);

    let breaks: readonly string[] = [];
    const staleBreaks = createHarness({ records: railRecords, capacity: 16, getIncomingInterpolationBreakKeyIds: () => breaks });
    const breaksPublication = staleBreaks.actions.physicalActions.prepareKeyRailDrag('A', 3);
    if (!breaksPublication.ok) throw new Error('Break publication must prepare');
    breaks = ['A'];
    expect(await staleBreaks.actions.physicalActions.commitKeyRailDrag(breaksPublication.publication)).toBe(false);

    for (const harness of [staleRecords, staleInterpolation, staleLoops, staleBreaks]) {
      expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
      expect(harness.publishStatus).not.toHaveBeenCalled();
    }
  });

  it('commits the exact retained move-key-rail objects once without recomputation', async () => {
    const { actions, executePhysicalEdit } = createHarness({ records: railRecords, capacity: 16 });
    const preparation = actions.physicalActions.prepareKeyRailDrag('A', 3);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Key Rail drag must prepare');

    expect(await actions.physicalActions.commitKeyRailDrag(preparation.publication)).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as {
      proposal: unknown;
      expectedLaunch: unknown;
      operationKind: string;
      intent: unknown;
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.expectedLaunch).toBe(preparation.publication.expectedLaunch);
    expect(dispatched.operationKind).toBe('move-key-rail');
    expect(dispatched.intent).toBe(preparation.publication.intent);
    expect(dispatched.selectedKeyId).toBe(preparation.publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(preparation.publication.proposal.selectedAppFrame);
  });
});

describe('useRotoTimelineActions Key Rail drag status and post-commit stability', () => {
  const railRecords = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 3),
    realKeyRecord('C', 6),
    realKeyRecord('D', 10),
  ];

  it('maps the exact accepted no-gap and inclusive-gap product copy', () => {
    expect(mapRotoKeyRailDragProductReason({
      kind: 'accepted',
      destinationFirstKeyAppFrame: 12,
      vacatedInterval: null,
    })).toBe('Moved Key Rail to frame 12.');
    expect(mapRotoKeyRailDragProductReason({
      kind: 'accepted',
      destinationFirstKeyAppFrame: 3,
      vacatedInterval: { phaseOrigin: 0, effectiveEnd: 3 },
    })).toBe('Moved Key Rail to frame 3. Gap left at frames 0–2.');
  });

  it('reuses the shared no-space product copy without exposing resolver diagnostics', () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({ records: railRecords, capacity: 16 });
    const preparation = actions.physicalActions.prepareKeyRailDrag('A', 0);

    expect(preparation.ok).toBe(false);
    if (preparation.ok) throw new Error('No-space Key Rail drag must reject');
    expect(preparation.reason).toBe('No empty space in that direction.');
    expect(preparation.reason).not.toContain('no free space');
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).not.toHaveBeenCalled();
  });

  it('publishes accepted destination and gap only after acknowledged commit', async () => {
    const { actions, executePhysicalEdit, publishStatus, publishDiagnostic } = createHarness({
      records: railRecords,
      capacity: 16,
    });
    const preparation = actions.physicalActions.prepareKeyRailDrag('A', 3);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Key Rail drag must prepare');

    expect(preparation.publication.destinationFirstKeyAppFrame).toBe(3);
    expect(preparation.publication.vacatedInterval).toEqual({ phaseOrigin: 0, effectiveEnd: 3 });
    expect(await actions.physicalActions.commitKeyRailDrag(preparation.publication)).toBe(true);

    const dispatched = executePhysicalEdit.mock.calls[0][0] as {
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.selectedKeyId).toBe(preparation.publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(preparation.publication.proposal.selectedAppFrame);
    expect(publishStatus).toHaveBeenCalledTimes(1);
    expect(publishStatus).toHaveBeenCalledWith('Moved Key Rail to frame 3. Gap left at frames 0–2.');
    expect(publishDiagnostic).not.toHaveBeenCalled();
  });

  it('publishes no accepted status when the parent rejects the retained transaction', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({ records: railRecords, capacity: 16 });
    executePhysicalEdit.mockResolvedValue(false);
    const preparation = actions.physicalActions.prepareKeyRailDrag('A', 3);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Key Rail drag must prepare');

    expect(await actions.physicalActions.commitKeyRailDrag(preparation.publication)).toBe(false);
    expect(publishStatus).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions Group-drag prepare/commit publication pair', () => {
  const groupRecords = [
    realKeyRecord('A', 1),
    realKeyRecord('B', 3),
    realKeyRecord('C', 5),
    realKeyRecord('D', 10),
  ];
  const group = lifecycleGroup({
    loopId: 'group-1',
    placementStart: 1,
    sourceKeyIds: Object.freeze(['A', 'C']),
    phaseOrigin: 1,
    originalEndExclusive: 9,
    // Lifecycle validator requires strictly increasing ranges with a gap
    // (start > previous endExclusive); contiguous ranges are rejected.
    visibleRanges: Object.freeze([
      Object.freeze({ start: 1, endExclusive: 4 }),
      Object.freeze({ start: 5, endExclusive: 9 }),
    ]),
  });

  it('rejects in the same guard order as prepareRotoKeyGroupDrag', () => {
    const noLaunch = createHarness({ launch: null, records: groupRecords, loopClips: [group] });
    expect(noLaunch.actions.physicalActions.prepareRotoGroupDrag('group-1', 4)).toEqual({
      ok: false,
      reason: 'Select a real Roto key before editing the timeline.',
    });

    const noPorts = createHarness({ records: groupRecords, loopClips: [group], omitPhysicalEditPorts: true });
    expect(noPorts.actions.physicalActions.prepareRotoGroupDrag('group-1', 4)).toEqual({
      ok: false,
      reason: 'Timeline editing is unavailable.',
    });

    const inFlight = createHarness({ records: groupRecords, loopClips: [group], pendingOperationId: 'op-busy' });
    expect(inFlight.actions.physicalActions.prepareRotoGroupDrag('group-1', 4)).toEqual({
      ok: false,
      reason: 'A Roto physical edit is already in flight.',
    });
  });

  it('threads the incoming break collection into both the resolver input and a break-aware proposalVersion', () => {
    const base = { records: groupRecords, loopClips: [group], capacity: 16 };
    const withoutBreaks = createHarness({ ...base, incomingInterpolationBreakKeyIds: [] });
    const withBreaks = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['D'] });

    const plain = withoutBreaks.actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    const broken = withBreaks.actions.physicalActions.prepareRotoGroupDrag('group-1', 4);

    expect(plain.ok).toBe(true);
    expect(broken.ok).toBe(true);
    if (!plain.ok || !broken.ok) throw new Error('Both preparations must succeed');
    // Break authority reaches the fingerprint: identical except break authority
    // produce different proposalVersions (Pitfall 1).
    expect(plain.publication.proposalVersion).not.toBe(broken.publication.proposalVersion);

    // Break authority reaches the resolver input: a break owner outside the
    // identity set fails closed at prepare (resolver validation).
    const invalidBreak = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['unknown-break'] });
    const rejected = invalidBreak.actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('Invalid break authority must reject');
    expect(rejected.reason).toContain('does not exist');
  });

  it('rejects a no-change drag at prepare with no publication', () => {
    const { actions } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 1);
    expect(preparation.ok).toBe(false);
    if (preparation.ok) throw new Error('No-change group drag must reject');
    expect(preparation.reason).toBe('This move would not change the timeline.');
  });

  it('prepares and publishes Infinity Group movement against the child document capacity (43.4 defect 1)', async () => {
    const infinityRecords = [realKeyRecord('A', 10), realKeyRecord('B', 12)];
    const infinityGroup = lifecycleGroup({
      placementStart: 10,
      sourceKeyIds: Object.freeze(['A', 'B']),
      repeat: 'infinity',
      mode: 'static',
      phaseOrigin: 10,
      originalEndExclusive: 40,
      visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 40 })]),
    });
    const { actions, executePhysicalEdit } = createHarness({
      records: infinityRecords,
      loopClips: [infinityGroup],
      parentEndExclusive: 40,
      capacity: 600,
    });

    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 16);

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Infinity Group drag must prepare.');
    expect(preparation.publication.proposal.nextLoopClips?.[0]).toMatchObject({
      placementStart: 16,
      phaseOrigin: 16,
      originalEndExclusive: 600,
      visibleRanges: [{ start: 16, endExclusive: 600 }],
    });

    expect(await actions.physicalActions.commitRotoGroupDrag(preparation.publication)).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'move-group',
      proposal: preparation.publication.proposal,
    }));
  });

  it('commits the exact retained move-group publication once', async () => {
    const { actions, executePhysicalEdit } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Group drag must prepare');
    // Task 1 (plan 02) clamps before computing delta (D-05): destination 4
    // clamps to 2 so the interval [2,10) stops at unowned D@10, delta 1.
    expect(Object.fromEntries(preparation.publication.proposal.mapping)).toEqual({ A: 2, B: 3, C: 6, D: 10 });

    const accepted = await actions.physicalActions.commitRotoGroupDrag(preparation.publication);

    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: unknown;
      operationKind: string;
      intent: unknown;
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.operationKind).toBe('move-group');
    expect(dispatched.intent).toBe(preparation.publication.intent);
    expect(dispatched.selectedKeyId).toBe(preparation.publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(preparation.publication.proposal.selectedAppFrame);
  });

  it('rejects a retained Group proposal when structural authority changes before commit', async () => {
    const records = [...groupRecords];
    const { actions, executePhysicalEdit } = createHarness({ records, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Group drag must prepare');

    records.push(realKeyRecord('new-authority', 15));

    expect(await actions.physicalActions.commitRotoGroupDrag(preparation.publication)).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('rejects a mismatched or empty-launch publication without dispatching', async () => {
    const { actions, executePhysicalEdit } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Group drag must prepare');
    const publication = preparation.publication;

    const kindMismatch = {
      ...publication,
      proposal: {
        ...publication.proposal,
        status: { ...publication.proposal.status, operationKind: 'move-key-group' as const },
      },
    };
    expect(await actions.physicalActions.commitRotoGroupDrag(kindMismatch)).toBe(false);

    const loopMismatch = { ...publication, loopId: 'other-loop' };
    expect(await actions.physicalActions.commitRotoGroupDrag(loopMismatch)).toBe(false);

    const emptyLaunch = { ...publication, expectedLaunch: { operationId: '', layerId: '' } };
    expect(await actions.physicalActions.commitRotoGroupDrag(emptyLaunch)).toBe(false);

    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions Group-drag status, busy gate, and post-commit stability (43.3-03 Task 2)', () => {
  const groupRecords = [
    realKeyRecord('A', 1),
    realKeyRecord('B', 3),
    realKeyRecord('C', 5),
    realKeyRecord('D', 10),
  ];
  const group = lifecycleGroup({
    loopId: 'group-1',
    placementStart: 1,
    sourceKeyIds: Object.freeze(['A', 'C']),
    phaseOrigin: 1,
    originalEndExclusive: 9,
    visibleRanges: Object.freeze([
      Object.freeze({ start: 1, endExclusive: 4 }),
      Object.freeze({ start: 5, endExclusive: 9 }),
    ]),
  });
  // A duplicated shared-source placement (D-11): placementStart 10 differs from
  // the first source key frame A@1, so its keys never move with the drag.
  const duplicatedGroup = lifecycleGroup({
    loopId: 'group-dup',
    placementStart: 10,
    sourceKeyIds: Object.freeze(['A', 'C']),
    mode: 'static',
    phaseOrigin: 10,
    originalEndExclusive: 18,
    visibleRanges: Object.freeze([
      Object.freeze({ start: 10, endExclusive: 13 }),
      Object.freeze({ start: 14, endExclusive: 18 }),
    ]),
  });
  // A source-attached Group pinned at the end of content with an unowned
  // boundary key immediately after its interval and a tight capacity: every
  // rightward destination either exceeds capacity or contains B@16, so the
  // plan-02 clamp returns ok:false (D-06 substrate).
  const endOfContentGroup = lifecycleGroup({
    loopId: 'group-1',
    placementStart: 10,
    sourceKeyIds: Object.freeze(['A', 'C']),
    phaseOrigin: 10,
    originalEndExclusive: 16,
    visibleRanges: Object.freeze([Object.freeze({ start: 10, endExclusive: 16 })]),
  });
  const endOfContentRecords = [
    realKeyRecord('A', 10),
    realKeyRecord('B', 16),
    realKeyRecord('C', 12),
  ];

  it('publishes the locked no-space copy with zero mutation when the clamp finds no free space (D-06)', () => {
    const { actions, executePhysicalEdit } = createHarness({ records: endOfContentRecords, loopClips: [endOfContentGroup], capacity: 20 });
    // Rightward drag to 15: every destination [d, d+6) either exceeds capacity
    // 20 or contains the boundary key B@16, so the plan-02 clamp returns
    // ok:false and the mapper publishes the locked literal copy.
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 15);
    expect(preparation.ok).toBe(false);
    if (preparation.ok) throw new Error('No-space group drag must reject');
    expect(preparation.reason).toBe('No empty space in that direction.');
    expect(preparation.reason).not.toContain('no free space');
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('publishes the accepted destination copy with no gap fact for a duplicated placement (D-07, D-11)', async () => {
    const { actions, publishStatus } = createHarness({
      records: [realKeyRecord('A', 1), realKeyRecord('C', 5)],
      loopClips: [duplicatedGroup],
      capacity: 24,
    });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-dup', 12);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Duplicated group drag must prepare');
    expect(preparation.publication.clampedDestinationPlacementStart).toBe(12);
    expect(preparation.publication.vacatedInterval).toBeNull();

    const accepted = await actions.physicalActions.commitRotoGroupDrag(preparation.publication);
    expect(accepted).toBe(true);
    expect(publishStatus).toHaveBeenCalledWith('Moved Static Rail to frame 12.');
  });

  it('appends the inclusive vacated-gap range when a source-attached move opens a gap (D-07)', async () => {
    const { actions, publishStatus } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Group drag must prepare');
    // Destination 4 clamps to 2 (D-05); the vacated interval is the Group's
    // original half-open span [1,9) → inclusive product range 1–8.
    expect(preparation.publication.clampedDestinationPlacementStart).toBe(2);
    expect(preparation.publication.vacatedInterval).toEqual({ phaseOrigin: 1, effectiveEnd: 9 });

    const accepted = await actions.physicalActions.commitRotoGroupDrag(preparation.publication);
    expect(accepted).toBe(true);
    expect(publishStatus).toHaveBeenCalledWith('Moved Motion Rail to frame 2. Gap left at frames 1–8.');
  });

  it('publishes the shared Infinity boundary when deleted tail fragments end before the child document capacity (43.4 defect 1)', () => {
    const infinityGroup = lifecycleGroup({
      placementStart: 10,
      sourceKeyIds: Object.freeze(['A', 'B']),
      repeat: 'infinity',
      mode: 'static',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: Object.freeze([
        Object.freeze({ start: 10, endExclusive: 18 }),
        Object.freeze({ start: 20, endExclusive: 25 }),
      ]),
    });
    const { actions } = createHarness({
      records: [realKeyRecord('A', 10), realKeyRecord('B', 12)],
      loopClips: [infinityGroup],
      parentEndExclusive: 30,
      capacity: 40,
    });

    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 8);

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Fragmented Infinity Group drag must prepare');
    expect(preparation.publication.vacatedInterval).toEqual({ phaseOrigin: 10, effectiveEnd: 40 });
  });

  it('routes disabled, rejection, and acceptance copy through the single Group-drag mapper', () => {
    // Disabled preflight flows through the mapper.
    const noLaunch = createHarness({ launch: null, records: groupRecords, loopClips: [group] });
    const disabled = noLaunch.actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(disabled.ok).toBe(false);
    if (disabled.ok) throw new Error('Disabled preflight must reject');
    expect(disabled.reason).toBe(
      mapRotoGroupDragProductReason({ kind: 'disabled', reason: 'Select a real Roto key before editing the timeline.' }),
    );
    // Zero-space rejection maps to the locked literal copy — never the raw
    // resolver diagnostic (T-43.3-03-03).
    const { actions } = createHarness({ records: endOfContentRecords, loopClips: [endOfContentGroup], capacity: 20 });
    const rejected = actions.physicalActions.prepareRotoGroupDrag('group-1', 15);
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new Error('No-space group drag must reject');
    expect(rejected.reason).toBe(mapRotoGroupDragProductReason({
      kind: 'rejected',
      failureCode: 'no-free-space-in-direction',
      failureText: 'Group drag has no free space in the dragged direction.',
    }));
    expect(rejected.reason).not.toContain('no free space');
    // Acceptance copy flows through the mapper.
    expect(mapRotoGroupDragProductReason({
      kind: 'accepted',
      mode: 'progressive',
      destinationPlacementStart: 2,
      vacatedInterval: { phaseOrigin: 1, effectiveEnd: 9 },
    })).toBe('Moved Motion Rail to frame 2. Gap left at frames 1–8.');
    expect(mapRotoGroupDragProductReason({
      kind: 'accepted',
      mode: 'static',
      destinationPlacementStart: 12,
      vacatedInterval: null,
    })).toBe('Moved Static Rail to frame 12.');
  });

  it('rejects a second drag session while a Group mutation is in flight (busy gate, T-43.3-03-04)', () => {
    const { actions } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16, pendingOperationId: 'op-in-flight' });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(false);
    if (preparation.ok) throw new Error('Busy gate must reject');
    expect(preparation.reason).toBe('A Roto physical edit is already in flight.');
  });

  it('keeps the moved Group selected with the cursor unmoved and no navigation after acceptance (D-17)', async () => {
    const { actions, executePhysicalEdit, publishStatus, publishDiagnostic } = createHarness({ records: groupRecords, loopClips: [group], capacity: 16 });
    const preparation = actions.physicalActions.prepareRotoGroupDrag('group-1', 4);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Group drag must prepare');
    const publication = preparation.publication;

    const accepted = await actions.physicalActions.commitRotoGroupDrag(publication);
    expect(accepted).toBe(true);
    // The moved Group stays selected and the physical cursor stays put: the
    // publication's selectedKeyId/selectedAppFrame are forwarded unchanged.
    const dispatched = executePhysicalEdit.mock.calls[0][0] as {
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.selectedKeyId).toBe(publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(publication.proposal.selectedAppFrame);
    // No navigation and no error diagnostics: the commit path only publishes
    // the accepted status. Canvas reconciliation runs through the existing
    // current-frame reconciliation path in the Studio handler, which re-renders
    // only when the current frame's content changed (43.1-04 precedent).
    expect(publishDiagnostic).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledTimes(1);
    expect(publishStatus).toHaveBeenCalledWith('Moved Motion Rail to frame 2. Gap left at frames 1–8.');
  });
});

describe('useRotoTimelineActions Scissor availability and activation', () => {
  const records = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 3),
    realKeyRecord('C', 6),
    realKeyRecord('D', 9),
  ];
  const group = lifecycleGroup({
    placementStart: 6,
    sourceKeyIds: Object.freeze(['C']),
    phaseOrigin: 6,
    originalEndExclusive: 10,
    visibleRanges: Object.freeze([Object.freeze({ start: 6, endExclusive: 10 })]),
    frameOverrides: Object.freeze([Object.freeze({ appFrame: 9, keyId: 'D' })]),
  });
  const base = {
    launchReady: true,
    pendingOperationId: null,
    selectedKeyId: null,
    selectedLoopClipIds: [] as readonly string[],
    currentAppFrame: 0,
    capacity: 12,
    records,
    loopClips: [group],
    physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    frameResolution: null,
    incomingInterpolationBreakKeyIds: [] as readonly string[],
  };

  it('prefers a selected ordinary key, falls back to the cursor key, and ignores rail selection alone', () => {
    expect(classifyRotoScissorTarget({ ...base, selectedKeyId: 'B' })).toEqual({
      kind: 'ok',
      keyId: 'B',
      appFrame: 3,
    });
    expect(classifyRotoScissorTarget(base)).toEqual({ kind: 'ok', keyId: 'A', appFrame: 0 });
    expect(classifyRotoScissorTarget({ ...base, selectedLoopClipIds: ['group-1'] })).toEqual({
      kind: 'ok',
      keyId: 'A',
      appFrame: 0,
    });
    expect(classifyRotoScissorTarget({ ...base, selectedKeyId: 'C' })).toEqual({
      kind: 'ok',
      keyId: 'A',
      appFrame: 0,
    });
  });

  it('classifies every guarded arm fail-closed and maps the locked product reason', () => {
    const generatedCells = [] as PhysicPaintRotoPhysicalCell[];
    generatedCells[2] = { kind: 'generated', appFrame: 2, leftKeyId: 'A', rightKeyId: 'B' };
    const cases = [
      [classifyRotoScissorTarget({ ...base, pendingOperationId: 'busy' }), 'A Roto physical edit is already in flight.'],
      [classifyRotoScissorTarget({ ...base, launchReady: false }), 'Scissor is unavailable.'],
      [classifyRotoScissorTarget({ ...base, currentAppFrame: 2, physicalCells: generatedCells }), 'Scissor is unavailable on a generated frame. Select a real ordinary key.'],
      [classifyRotoScissorTarget({ ...base, currentAppFrame: 2 }), 'Scissor is unavailable on an empty frame. Select a real ordinary key.'],
      [classifyRotoScissorTarget({ ...base, selectedKeyId: 'C', currentAppFrame: 6 }), 'Scissor is unavailable on a Motion or Static Group frame.'],
      [classifyRotoScissorTarget({ ...base, currentAppFrame: 2, frameResolution: { kind: 'linked' } as never }), 'Scissor is unavailable on a linked Group frame.'],
      [classifyRotoScissorTarget({ ...base, incomingInterpolationBreakKeyIds: ['A'] }), 'This key already starts a Key Rail segment.'],
      [classifyRotoScissorTarget(base), null],
    ] as const;

    for (const [target, reason] of cases) {
      expect(mapRotoScissorProductReason(target)).toBe(reason);
    }
  });

  it('returns an exact silent no-op when the target already owns a break', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records,
      selectedKeyId: 'A',
      incomingInterpolationBreakKeyIds: ['A'],
      capacity: 12,
    });

    expect(actions.physicalActions.canScissor.value).toBe(false);
    expect(actions.physicalActions.scissorDisabledReason.value).toBe('This key already starts a Key Rail segment.');
    expect(await actions.physicalActions.scissorKeyRail()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).not.toHaveBeenCalled();
  });

  it('routes an eligible owner through the physical runner with locked acceptance copy', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records,
      selectedKeyId: 'B',
      incomingInterpolationBreakKeyIds: ['A'],
      capacity: 12,
    });

    expect(actions.physicalActions.canScissor.value).toBe(true);
    expect(actions.physicalActions.scissorDisabledReason.value).toBeNull();
    expect(await actions.physicalActions.scissorKeyRail()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledWith(expect.objectContaining({
      operationKind: 'scissor-key-rail',
      intent: { kind: 'scissor-key-rail', breakOwnerKeyId: 'B' },
    }));
    expect(publishStatus).toHaveBeenCalledWith('Split Key Rail before frame 3.');
  });
});
