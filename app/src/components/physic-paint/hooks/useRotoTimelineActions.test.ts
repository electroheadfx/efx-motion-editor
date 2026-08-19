import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { PhysicPaintLaunchContext, RailSetDeleteMember } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { RailSetIdentity } from '../roto/physicsPaintRotoRailSetSelection';
import {
  derivePhysicPaintRotoLoopRanges,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoPhysicalCell,
} from '../roto/physicsPaintRotoPhysicalResolver';
import { projectPhysicsPaintLoopClipGeometry } from '../view/physicsPaintLoopClipPresentation';
import { resolvePhysicPaintPushAnchor } from '../view/physicsPaintKeyRailPresentation';
import {
  getPhysicsPaintRotoSourceCycleId,
  togglePhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingSelection,
} from '../roto/physicsPaintRotoSpacingSelection';
import {
  buildRailSetCopy,
  buildRailSetSoloCopy,
  buildRailSetTooltipSentence,
  classifyRotoDeleteTarget,
  classifyRotoInsertTarget,
  classifyRotoScissorTarget,
  mapRotoDeleteProductReason,
  mapRotoGroupDragProductReason,
  mapRotoInsertProductReason,
  mapRotoScissorProductReason,
  mapRotoKeyRailDragProductReason,
  mapRotoPushProductReason,
  mapRotoRailSetMoveProductReason,
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
  railSetMembers?: readonly RailSetIdentity[];
  executeRailSetDelete?: (target: Readonly<{
    operationKind: 'delete-rails';
    members: readonly RailSetDeleteMember[];
  }>) => Promise<boolean>;
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
    getRailSetMembers: () => options.railSetMembers ?? [],
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
    executeRailSetDelete: options.executeRailSetDelete,
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

/** `count` contiguous real keys named `<firstKeyId><index>` starting at `startFrame`. */
function keyRailRecords(firstKeyId: string, startFrame: number, count: number): PhysicPaintRotoRealKeyRecord[] {
  const records: PhysicPaintRotoRealKeyRecord[] = [];
  for (let index = 0; index < count; index += 1) {
    records.push(realKeyRecord(`${firstKeyId}${index}`, startFrame + index));
  }
  return records;
}

/** One exact-match Key Rail set member over `count` contiguous keys named `<prefix><index>`. */
function keyRailMember(prefix: string, count: number): Readonly<{
  kind: 'key-rail';
  firstKeyId: string;
  keyIds: readonly string[];
}> {
  return Object.freeze({
    kind: 'key-rail',
    firstKeyId: `${prefix}0`,
    keyIds: Object.freeze(Array.from({ length: count }, (_, index) => `${prefix}${index}`)),
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
    expect(multiple.executePhysicalEdit).toHaveBeenCalledTimes(1);
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

  it('classifies an active mixed rail set as Delete Rails before any single-rail branch', () => {
    const group = lifecycleGroup({
      placementStart: 12,
      sourceKeyIds: Object.freeze(['A', 'B', 'C']),
      repeat: 10,
      phaseOrigin: 12,
      originalEndExclusive: 42,
      visibleRanges: Object.freeze([Object.freeze({ start: 12, endExclusive: 41 })]),
    });
    const target = classifyRotoDeleteTarget({
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedKeyRail: null,
      selectedLoopClipIds: ['group-1'] as readonly string[],
      railSetMembers: [
        { kind: 'loop', loopId: 'group-1' },
        { kind: 'key-rail', firstKeyId: 'rail-a' },
        { kind: 'key-rail', firstKeyId: 'rail-c' },
      ] as readonly RailSetIdentity[],
      currentAppFrame: 12,
      capacity: 100,
      records: [
        realKeyRecord('rail-a', 12),
        realKeyRecord('rail-b', 15),
        realKeyRecord('rail-c', 20),
        realKeyRecord('rail-d', 88),
      ],
      loopClips: [group],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      incomingInterpolationBreakKeyIds: ['rail-c'] as readonly string[],
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    });

    expect(target).toEqual({
      kind: 'rail-set',
      members: [
        { kind: 'loop', loopId: 'group-1' },
        { kind: 'key-rail', firstKeyId: 'rail-a', keyIds: ['rail-a', 'rail-b'] },
        { kind: 'key-rail', firstKeyId: 'rail-c', keyIds: ['rail-c', 'rail-d'] },
      ],
      firstFrame: 12,
      lastFrame: 88,
    });
    expect(mapRotoDeleteProductReason(target)).toBeNull();
  });

  it('fails closed when a rail set key-rail member no longer matches the accepted derivation', () => {
    const target = classifyRotoDeleteTarget({
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedKeyRail: null,
      selectedLoopClipIds: [] as readonly string[],
      railSetMembers: [{ kind: 'key-rail', firstKeyId: 'rail-a' }] as readonly RailSetIdentity[],
      currentAppFrame: 5,
      capacity: 20,
      records: [realKeyRecord('rail-b', 5), realKeyRecord('rail-c', 9)],
      loopClips: [] as readonly PhysicPaintRotoLoopClip[],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      incomingInterpolationBreakKeyIds: [] as readonly string[],
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    });

    expect(target).toEqual({ kind: 'stale-key-rail' });
    expect(mapRotoDeleteProductReason(target)).toBe('The selected Key Rail is no longer available.');
  });

  it('fails closed when a rail set loop member is gone', () => {
    const target = classifyRotoDeleteTarget({
      launchReady: true,
      pendingOperationId: null,
      selectedKeyId: null,
      selectedKeyIds: [] as readonly string[],
      selectedKeyRail: null,
      selectedLoopClipIds: [] as readonly string[],
      railSetMembers: [{ kind: 'loop', loopId: 'group-1' }] as readonly RailSetIdentity[],
      currentAppFrame: 5,
      capacity: 20,
      records: [realKeyRecord('rail-a', 2)],
      loopClips: [] as readonly PhysicPaintRotoLoopClip[],
      interpolation: { enabled: true, mode: 'duplicate' as const },
      incomingInterpolationBreakKeyIds: [] as readonly string[],
      physicalCells: [] as readonly PhysicPaintRotoPhysicalCell[],
    });

    expect(target).toEqual({ kind: 'stale-key-rail' });
  });

  it('dispatches Delete Rails directly through the executeRailSetDelete port with the locked acceptance copy', async () => {
    const executeRailSetDelete = vi.fn(async () => true);
    const requestGroupDeleteChoice = vi.fn();
    const requestSoleOccurrenceDeleteWarning = vi.fn();
    const harness = createHarness({
      records: [
        realKeyRecord('rail-a', 12),
        realKeyRecord('rail-b', 15),
        realKeyRecord('rail-c', 20),
        realKeyRecord('rail-d', 88),
      ],
      loopClips: [lifecycleGroup({
        placementStart: 12,
        sourceKeyIds: Object.freeze(['A', 'B', 'C']),
        repeat: 10,
        phaseOrigin: 12,
        originalEndExclusive: 42,
        visibleRanges: Object.freeze([Object.freeze({ start: 12, endExclusive: 41 })]),
      })],
      railSetMembers: [
        { kind: 'loop', loopId: 'group-1' },
        { kind: 'key-rail', firstKeyId: 'rail-a' },
        { kind: 'key-rail', firstKeyId: 'rail-c' },
      ],
      incomingInterpolationBreakKeyIds: ['rail-c'],
      currentAppFrame: 12,
      capacity: 100,
      executeRailSetDelete,
      requestGroupDeleteChoice,
      requestSoleOccurrenceDeleteWarning,
    });

    expect(harness.actions.physicalActions.deleteScopeLabel.value).toBe('Delete 3 Rails');
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(executeRailSetDelete).toHaveBeenCalledWith({
      operationKind: 'delete-rails',
      members: [
        { kind: 'loop', loopId: 'group-1' },
        { kind: 'key-rail', firstKeyId: 'rail-a', keyIds: ['rail-a', 'rail-b'] },
        { kind: 'key-rail', firstKeyId: 'rail-c', keyIds: ['rail-c', 'rail-d'] },
      ],
    });
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    expect(requestGroupDeleteChoice).not.toHaveBeenCalled();
    expect(requestSoleOccurrenceDeleteWarning).not.toHaveBeenCalled();
    expect(harness.publishStatus).toHaveBeenCalledWith(
      'Deleted 3 Rails - frames 12-88. The intervals stay intentional gaps.',
    );
  });

  it('deletes a one-member rail set with the singular locked copy', async () => {
    const executeRailSetDelete = vi.fn(async () => true);
    const harness = createHarness({
      records: [realKeyRecord('rail-a', 12)],
      loopClips: [lifecycleGroup({
        placementStart: 12,
        sourceKeyIds: Object.freeze(['A', 'B', 'C']),
        repeat: 10,
        phaseOrigin: 12,
        originalEndExclusive: 42,
        visibleRanges: Object.freeze([Object.freeze({ start: 12, endExclusive: 41 })]),
      })],
      railSetMembers: [{ kind: 'loop', loopId: 'group-1' }],
      currentAppFrame: 12,
      capacity: 100,
      executeRailSetDelete,
    });

    expect(harness.actions.physicalActions.deleteScopeLabel.value).toBe('Delete 1 Rail');
    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(true);
    expect(executeRailSetDelete).toHaveBeenCalledWith({
      operationKind: 'delete-rails',
      members: [{ kind: 'loop', loopId: 'group-1' }],
    });
    expect(harness.publishStatus).toHaveBeenCalledWith(
      'Deleted 1 Rail - frames 12-40. The interval stays an intentional gap.',
    );
  });

  it('rejects a stale rail set before mutation or success publication', async () => {
    const executeRailSetDelete = vi.fn(async () => true);
    const harness = createHarness({
      records: [realKeyRecord('rail-b', 5), realKeyRecord('rail-c', 9)],
      railSetMembers: [{ kind: 'key-rail', firstKeyId: 'rail-a' }],
      currentAppFrame: 5,
      capacity: 20,
      executeRailSetDelete,
    });

    expect(await harness.actions.physicalActions.deleteRotoFrame()).toBe(false);
    expect(executeRailSetDelete).not.toHaveBeenCalled();
    expect(harness.executePhysicalEdit).not.toHaveBeenCalled();
    expect(harness.publishStatus).toHaveBeenCalledTimes(1);
    expect(harness.publishStatus).toHaveBeenCalledWith('The selected Key Rail is no longer available.');
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
      'Insert an empty key connected to the previous segment.',
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
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['key-after']);
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
      'Inserted empty key at frame 3. Connected to the previous segment.',
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
        nextIncomingInterpolationBreakKeyIds: readonly string[] | null;
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
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([newKeyId]);
    expect(publishStatus).toHaveBeenCalledWith('Added an empty Roto key.');
  });

  it('joins an existing Key Rail when the destination is strictly inside a segment span', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('k0', 0), realKeyRecord('k4', 4), realKeyRecord('k8', 8)],
    });
    const accepted = await actions.physicalKeyUtilities.addEmptyKey(6, blankPayload(6));
    expect(accepted).toBe(true);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        nextRecords: readonly PhysicPaintRotoRealKeyRecord[] | null;
        nextIncomingInterpolationBreakKeyIds: readonly string[] | null;
      };
    };
    // 260819-wzi: a destination strictly inside the 0/4/8 segment span joins the
    // rail (→ 0/4/6/8) instead of spawning a spurious one-key rail.
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([]);
    expect(dispatched.proposal.nextRecords).toHaveLength(4);
  });

  it('keeps a trailing-space destination on its own one-key rail (guard)', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('k0', 0), realKeyRecord('k4', 4), realKeyRecord('k8', 8)],
      capacity: 20,
    });
    await actions.physicalKeyUtilities.addEmptyKey(10, blankPayload(10));
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        mapping: ReadonlyMap<string, number>;
        nextIncomingInterpolationBreakKeyIds: readonly string[] | null;
      };
    };
    const newKeyId = [...dispatched.proposal.mapping.entries()]
      .find(([, frame]) => frame === 10)?.[0];
    expect(newKeyId).toBeDefined();
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([newKeyId]);
  });

  it('keeps a gap destination on its own one-key rail when no segment strictly spans it (guard)', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('k0', 0), realKeyRecord('k4', 4), realKeyRecord('k8', 8)],
      incomingInterpolationBreakKeyIds: ['k4'],
    });
    await actions.physicalKeyUtilities.addEmptyKey(1, blankPayload(1));
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: {
        mapping: ReadonlyMap<string, number>;
        nextIncomingInterpolationBreakKeyIds: readonly string[] | null;
      };
    };
    const newKeyId = [...dispatched.proposal.mapping.entries()]
      .find(([, frame]) => frame === 1)?.[0];
    expect(newKeyId).toBeDefined();
    // 43.4 SC-4: frame 1 is NOT strictly inside either derived span ([0] or
    // [4,8]), so the new key keeps its own one-key rail. The pre-existing break
    // owning k4 is preserved alongside the new key's own break.
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toContain(newKeyId);
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toContain('k4');
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

describe('useRotoTimelineActions rail-set Key Spacing (43.6-05, D-24/D-25/D-26)', () => {
  const setRecords = [
    realKeyRecord('A', 0),
    realKeyRecord('B', 1),
    realKeyRecord('C', 2),
    realKeyRecord('X', 20),
    realKeyRecord('Y', 21),
  ];
  const setLoopClips: readonly PhysicPaintRotoLoopClip[] = [
    {
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: ['X', 'Y'],
      repeat: 4,
      mode: 'static',
    },
  ];
  const mixedSet: readonly RailSetIdentity[] = [
    { kind: 'key-rail', firstKeyId: 'A' },
    { kind: 'loop', loopId: 'loop-G' },
  ];

  it('derives per-rail member descriptors from an active mixed set and dispatches spacing-on-set', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: setRecords,
      loopClips: setLoopClips,
      railSetMembers: mixedSet,
      capacity: 40,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      operationKind: string;
      intent: {
        kind: string;
        members: readonly { kind: string; firstKeyId?: string; keyIds?: readonly string[]; loopId?: string }[];
        emptyFrames: number;
      };
      proposal: { mapping: ReadonlyMap<string, number> };
    };
    expect(dispatched.operationKind).toBe('spacing-on-set');
    expect(dispatched.intent.kind).toBe('spacing-on-set');
    expect(dispatched.intent.emptyFrames).toBe(1);
    // The set branch expands the Plan 01 identities into per-rail member
    // descriptors (key-rail firstKeyId + keyIds / loop loopId).
    expect(dispatched.intent.members).toEqual([
      { kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C'] },
      { kind: 'loop', loopId: 'loop-G' },
    ]);
    // Per-rail anchors: A@0 -> 0,2,4; X@20 -> 20,22 (D-24).
    expect(Object.fromEntries(dispatched.proposal.mapping)).toEqual({ A: 0, B: 2, C: 4, X: 20, Y: 22 });
  });

  it('fails closed on a stale rail set with the mapped stale message', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: setRecords,
      loopClips: setLoopClips,
      railSetMembers: [{ kind: 'key-rail', firstKeyId: 'ZZZ' }],
      capacity: 40,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Rail set selection is stale. Select the Rails again.');
  });

  it('publishes the locked whole-set preflight rejection copy on collision (D-25)', async () => {
    // c0@4 is unselected; C lands at 4 — the whole command rejects.
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: [
        realKeyRecord('A', 0),
        realKeyRecord('B', 1),
        realKeyRecord('C', 2),
        realKeyRecord('c0', 4),
      ],
      incomingInterpolationBreakKeyIds: ['c0'],
      railSetMembers: [{ kind: 'key-rail', firstKeyId: 'A' }],
      capacity: 40,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(publishStatus).toHaveBeenCalledWith('Can\'t apply Key Spacing to the selected Rails: Spacing rejected — not enough room.');
  });

  it('publishes the locked accepted copy for a multi-rail set', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: setRecords,
      loopClips: setLoopClips,
      railSetMembers: mixedSet,
      capacity: 40,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    expect(publishStatus).toHaveBeenCalledWith('Key Spacing applied to 2 Rails.');
  });

  it('publishes the singular accepted copy for a one-rail set', async () => {
    const { actions, publishStatus } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 1)],
      railSetMembers: [{ kind: 'key-rail', firstKeyId: 'A' }],
      capacity: 40,
    });
    actions.physicalActions.setForceSpacingInput('1');

    expect(await actions.physicalActions.applyForceSpacing()).toBe(true);
    expect(publishStatus).toHaveBeenCalledWith('Key Spacing applied to 1 Rail.');
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

describe('useRotoTimelineActions Push prepare + locked copy family (43.5-03 Task 1)', () => {
  it('rejects in the same guard order as prepareRotoGroupDrag', () => {
    const noLaunch = createHarness({ launch: null });
    expect(noLaunch.actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    })).toEqual({ ok: false, reason: 'Select a real Roto key before editing the timeline.' });

    const noPorts = createHarness({ omitPhysicalEditPorts: true });
    expect(noPorts.actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    })).toEqual({ ok: false, reason: 'Timeline editing is unavailable.' });

    const inFlight = createHarness({ pendingOperationId: 'op-busy' });
    expect(inFlight.actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    })).toEqual({ ok: false, reason: 'A Roto physical edit is already in flight.' });
  });

  it('rejects a malformed anchor descriptor and a malformed delta before resolution', () => {
    const { actions } = createHarness({ records: [realKeyRecord('A', 0)], capacity: 10 });
    // XOR anchor violated: no anchor.
    expect(actions.physicalActions.prepareRotoPush({ direction: 'right', deltaFrames: 2 }))
      .toEqual({ ok: false, reason: 'The push anchor identity is malformed.' });
    // XOR anchor violated: both anchors.
    expect(actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      anchorLoopId: 'loop-1',
      deltaFrames: 2,
    })).toEqual({ ok: false, reason: 'The push anchor identity is malformed.' });
    // Unbounded anchor keyId.
    expect(actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'x'.repeat(300),
      deltaFrames: 2,
    })).toEqual({ ok: false, reason: 'The push anchor identity is malformed.' });
    // Negative delta.
    expect(actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: -1,
    })).toEqual({ ok: false, reason: 'The push delta is malformed.' });
  });

  it('threads the incoming break collection into a break-aware proposalVersion (Pitfall 3 regression)', () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1), realKeyRecord('C', 10)];
    const base = { records, capacity: 14 };
    const withoutBreaks = createHarness({ ...base });
    const withBreaks = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['B'] });

    const plain = withoutBreaks.actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });
    const broken = withBreaks.actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });

    expect(plain.ok).toBe(true);
    expect(broken.ok).toBe(true);
    if (!plain.ok || !broken.ok) throw new Error('Both push preparations must succeed');
    // Identical physical content except break authority produce different
    // proposalVersions — the break collection reaches the fingerprint (Pitfall 3).
    expect(plain.publication.proposalVersion).not.toBe(broken.publication.proposalVersion);
    // The added break (splitting the A/B rail) does not change the committed
    // mapping, so the version difference is attributable to break authority alone.
    expect(Object.fromEntries(plain.publication.proposal.mapping))
      .toEqual(Object.fromEntries(broken.publication.proposal.mapping));
  });

  it('rejects a zero-delta push with the no-change reason and no publication (D-15)', () => {
    const { actions } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 10)],
      capacity: 14,
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 0,
    });
    expect(preparation).toEqual({ ok: false, reason: 'This move would not change the timeline.' });
  });

  it('prepares a break-aware publication carrying proposal, intent, version, launch tuple, and presentation facts', () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1)];
    const group = lifecycleGroup({
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: Object.freeze(['A', 'B']),
      phaseOrigin: 0,
      originalEndExclusive: 2,
      visibleRanges: Object.freeze([Object.freeze({ start: 0, endExclusive: 2 })]),
    });
    const { actions } = createHarness({ records, loopClips: [group], capacity: 14 });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorLoopId: 'group-1',
      deltaFrames: 2,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Single-Group push must prepare');
    const pub = preparation.publication;
    expect(pub.proposal.status.operationKind).toBe('push-rails');
    expect(pub.proposal.status.changed).toBe(true);
    expect(pub.intent).toEqual({ kind: 'push-rails', direction: 'right', anchorLoopId: 'group-1', deltaFrames: 2 });
    expect(pub.expectedLaunch).toEqual({ operationId: 'op-1', layerId: 'layer-1' });
    expect(typeof pub.proposalVersion).toBe('string');
    expect(pub.proposalVersion.length).toBeGreaterThan(0);
    // The clamped +2 delta commits (preview-is-the-commit, D-14).
    expect(Object.fromEntries(pub.proposal.mapping)).toEqual({ A: 2, B: 3 });
    // Presentation facts: one moved Rail, clamped +2, moved set [0,2) → [2,4), gap [0,1].
    expect(pub.movedRailCount).toBe(1);
    expect(pub.clampedDeltaFrames).toBe(2);
    expect(pub.beforeRange).toEqual({ firstFrame: 0, lastFrame: 1 });
    expect(pub.afterRange).toEqual({ firstFrame: 2, lastFrame: 3 });
    expect(pub.gapInterval).toEqual({ firstFrame: 0, lastFrame: 1 });
    // The opened-gap break is recorded on the moved set's first key (PUSH-03).
    expect(pub.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['A']);
    // The moved Group clip translates with its lifecycle fields.
    expect(pub.proposal.nextLoopClips?.[0]).toMatchObject({ placementStart: 2, phaseOrigin: 2 });
  });

  it('fails closed with the no-space copy when the moved set is flush at capacity', () => {
    const records: PhysicPaintRotoRealKeyRecord[] = [];
    for (let index = 0; index < 10; index += 1) records.push(realKeyRecord(`a${index}`, index));
    for (let index = 0; index < 10; index += 1) records.push(realKeyRecord(`b${index}`, 30 + index));
    const { actions } = createHarness({ records, capacity: 40 });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'a0',
      deltaFrames: 2,
    });
    expect(preparation).toEqual({
      ok: false,
      reason: 'No empty space in that direction.',
      detail: expect.any(String),
    });
  });

  it('fails closed with the straddle copy when a moved attached Group shares its source with a fixed-side Group (D-16)', () => {
    const records = [realKeyRecord('g0', 20), realKeyRecord('g1', 21)];
    const loopG = lifecycleGroup({
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      phaseOrigin: 20,
      originalEndExclusive: 28,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 28 })]),
    });
    const loopD = lifecycleGroup({
      loopId: 'loop-D',
      placementStart: 2,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      mode: 'static',
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
    });
    const { actions } = createHarness({ records, loopClips: [loopD, loopG], capacity: 40 });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorLoopId: 'loop-G',
      deltaFrames: 2,
    });
    expect(preparation).toEqual({
      ok: false,
      reason: 'Can\'t push: a Group in the moved set shares its source with a fixed Group.',
      detail: expect.any(String),
    });
  });

  it('fails closed with the empty-anchor copy when the anchor is not a member of any Rail (D-07/D-17)', () => {
    const { actions } = createHarness({ records: [realKeyRecord('A', 0), realKeyRecord('B', 1)], capacity: 10 });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'nonexistent',
      deltaFrames: 2,
    });
    expect(preparation).toEqual({
      ok: false,
      reason: 'Push is unavailable on an empty frame. Drag from a key or rail.',
      detail: expect.any(String),
    });
  });

  it('maps the entire locked copy family verbatim (D-15/D-16/D-17, UI-SPEC T6)', () => {
    // Live readout, Push Right with gap — UI-SPEC T6 example verbatim.
    expect(mapRotoPushProductReason({
      kind: 'live',
      direction: 'right',
      signedDeltaFrames: 12,
      beforeRange: { firstFrame: 40, lastFrame: 87 },
      afterRange: { firstFrame: 52, lastFrame: 99 },
      gapInterval: { firstFrame: 40, lastFrame: 51 },
    })).toBe('Push Right +12 — frames 40–87 → 52–99, gap 40–51');
    // Live readout, Push Left mirror.
    expect(mapRotoPushProductReason({
      kind: 'live',
      direction: 'left',
      signedDeltaFrames: -12,
      beforeRange: { firstFrame: 52, lastFrame: 99 },
      afterRange: { firstFrame: 40, lastFrame: 87 },
      gapInterval: { firstFrame: 88, lastFrame: 99 },
    })).toBe('Push Left −12 — frames 52–99 → 40–87, gap 88–99');
    // Live readout with no gap: no gap sentence.
    expect(mapRotoPushProductReason({
      kind: 'live',
      direction: 'right',
      signedDeltaFrames: 2,
      beforeRange: { firstFrame: 0, lastFrame: 1 },
      afterRange: { firstFrame: 2, lastFrame: 3 },
      gapInterval: null,
    })).toBe('Push Right +2 — frames 0–1 → 2–3');
    // Accepted plural with gap.
    expect(mapRotoPushProductReason({
      kind: 'accepted',
      direction: 'right',
      movedRailCount: 2,
      signedDeltaFrames: 2,
      afterRange: { firstFrame: 2, lastFrame: 12 },
      gapInterval: { firstFrame: 0, lastFrame: 1 },
    })).toBe('Pushed 2 Rails right by 2 frames — moved set now frames 2–12. Gap opened at frames 0–1.');
    // Accepted singular without gap.
    expect(mapRotoPushProductReason({
      kind: 'accepted',
      direction: 'right',
      movedRailCount: 1,
      signedDeltaFrames: 2,
      afterRange: { firstFrame: 2, lastFrame: 3 },
      gapInterval: null,
    })).toBe('Pushed 1 Rail right by 2 frames — moved set now frames 2–3.');
    // Accepted plural left mirror with gap.
    expect(mapRotoPushProductReason({
      kind: 'accepted',
      direction: 'left',
      movedRailCount: 2,
      signedDeltaFrames: -2,
      afterRange: { firstFrame: 0, lastFrame: 4 },
      gapInterval: { firstFrame: 5, lastFrame: 6 },
    })).toBe('Pushed 2 Rails left by 2 frames — moved set now frames 0–4. Gap opened at frames 5–6.');
    // Disabled pass-through.
    expect(mapRotoPushProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }))
      .toBe('A Roto physical edit is already in flight.');
    // Straddle verbatim (D-16).
    expect(mapRotoPushProductReason({ kind: 'rejected', failureCode: 'push-source-straddle', failureText: 'x' }))
      .toBe('Can\'t push: a Group in the moved set shares its source with a fixed Group.');
    // Empty anchor verbatim (D-07/D-17).
    expect(mapRotoPushProductReason({ kind: 'rejected', failureCode: 'unknown-operation-identity', failureText: 'y' }))
      .toBe('Push is unavailable on an empty frame. Drag from a key or rail.');
    // No-space delegates to the Group mapper — one literal source (43.4 precedent).
    expect(mapRotoPushProductReason({ kind: 'rejected', failureCode: 'no-free-space-in-direction', failureText: 'z' }))
      .toBe('No empty space in that direction.');
  });

  it('prepares a Push Left publication whose presentation facts feed the locked mirror copy', () => {
    // The break on D splits D into its own Key Rail; [A,B,C] stays one Rail.
    // Under the 43.5-05 suffix set, anchoring C moves BOTH rails (everything at
    ///after C's start) — [A,B,C] and [D] translate left by 2.
    const records = [
      realKeyRecord('A', 2),
      realKeyRecord('B', 3),
      realKeyRecord('C', 6),
      realKeyRecord('D', 10),
    ];
    const { actions } = createHarness({
      records,
      capacity: 14,
      incomingInterpolationBreakKeyIds: ['D'],
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'left',
      anchorKeyId: 'C',
      deltaFrames: 2,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push Left must prepare');
    const pub = preparation.publication;
    expect(Object.fromEntries(pub.proposal.mapping)).toEqual({ A: 0, B: 1, C: 4, D: 8 });
    expect(pub.movedRailCount).toBe(2);
    expect(pub.clampedDeltaFrames).toBe(-2);
    expect(pub.beforeRange).toEqual({ firstFrame: 2, lastFrame: 10 });
    expect(pub.afterRange).toEqual({ firstFrame: 0, lastFrame: 8 });
    expect(pub.gapInterval).toEqual({ firstFrame: 9, lastFrame: 10 });
    // D is now a moved key, so its break travels with it (43.4 D-19).
    expect(pub.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['D']);
    // The mapped accepted copy from the retained facts.
    expect(mapRotoPushProductReason({
      kind: 'accepted',
      direction: pub.intent.direction,
      movedRailCount: pub.movedRailCount,
      signedDeltaFrames: pub.clampedDeltaFrames,
      afterRange: pub.afterRange,
      gapInterval: pub.gapInterval,
    })).toBe('Pushed 2 Rails left by 2 frames — moved set now frames 0–8. Gap opened at frames 9–10.');
  });
});

describe('useRotoTimelineActions Push commit + stale authority (43.5-03 Task 2)', () => {
  it('commits the exact retained push-rails publication once and publishes accepted copy from the continuation', async () => {
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 1)],
      capacity: 14,
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push must prepare');

    const accepted = await actions.physicalActions.commitRotoPush(preparation.publication);

    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: unknown;
      expectedLaunch: unknown;
      operationKind: string;
      intent: unknown;
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.expectedLaunch).toBe(preparation.publication.expectedLaunch);
    expect(dispatched.operationKind).toBe('push-rails');
    expect(dispatched.intent).toBe(preparation.publication.intent);
    expect(dispatched.selectedKeyId).toBe(preparation.publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(preparation.publication.proposal.selectedAppFrame);
    // Accepted copy publishes from the .then continuation — never runPhysicalAction.
    expect(publishStatus).toHaveBeenCalledWith(
      'Pushed 1 Rail right by 2 frames — moved set now frames 2–3. Gap opened at frames 0–1.',
    );
  });

  it('rejects a mismatched or empty-launch publication without dispatching (wrapper coherence)', async () => {
    const { actions, executePhysicalEdit } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 1)],
      capacity: 14,
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push must prepare');
    const publication = preparation.publication;

    const kindMismatch = {
      ...publication,
      proposal: {
        ...publication.proposal,
        status: { ...publication.proposal.status, operationKind: 'move-group' as const },
      },
    };
    expect(await actions.physicalActions.commitRotoPush(kindMismatch)).toBe(false);

    const intentMismatch = {
      ...publication,
      intent: { ...publication.intent, kind: 'move-group' as const },
    } as unknown as import('./useRotoTimelineActions').RotoPushPublication;
    expect(await actions.physicalActions.commitRotoPush(intentMismatch)).toBe(false);

    const emptyLaunch = { ...publication, expectedLaunch: { operationId: '', layerId: '' } };
    expect(await actions.physicalActions.commitRotoPush(emptyLaunch)).toBe(false);

    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('rejects a stale break-aware proposal version with zero mutation (T-43.5-01)', async () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1)];
    const breaks = ['B'];
    const { actions, executePhysicalEdit } = createHarness({
      records,
      capacity: 14,
      getIncomingInterpolationBreakKeyIds: () => breaks,
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push must prepare');

    // A concurrent Scissor edit changes ONLY the break collection after prepare.
    breaks.push('A');

    expect(await actions.physicalActions.commitRotoPush(preparation.publication)).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(breaks).toEqual(['B', 'A']);
  });

  it('rejects a stale structural authority with zero mutation (concurrent key edit)', async () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1)];
    const { actions, executePhysicalEdit } = createHarness({ records, capacity: 14 });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: 'A',
      deltaFrames: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push must prepare');

    records.push(realKeyRecord('new-authority', 12));

    expect(await actions.physicalActions.commitRotoPush(preparation.publication)).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions batch Move prepare + locked copy family (43.6-03 Task 2)', () => {
  it('rejects in the same guard order as prepareRotoPush', () => {
    const noLaunch = createHarness({ launch: null });
    expect(noLaunch.actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12)],
      delta: 2,
    })).toEqual({ ok: false, reason: 'Select a real Roto key before editing the timeline.' });

    const noPorts = createHarness({ omitPhysicalEditPorts: true });
    expect(noPorts.actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12)],
      delta: 2,
    })).toEqual({ ok: false, reason: 'Timeline editing is unavailable.' });

    const inFlight = createHarness({ pendingOperationId: 'op-busy' });
    expect(inFlight.actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12)],
      delta: 2,
    })).toEqual({ ok: false, reason: 'A Roto physical edit is already in flight.' });
  });

  it('rejects a malformed members descriptor and a malformed delta before resolution', () => {
    const { actions } = createHarness({ records: [realKeyRecord('A', 0), realKeyRecord('B', 1)], capacity: 10 });
    // Empty members array.
    expect(actions.physicalActions.prepareRailSetMove({ members: [], delta: 2 }))
      .toEqual({ ok: false, reason: 'The rail set move members are malformed.' });
    // Key Rail member with an empty keyIds array.
    expect(actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: [] }],
      delta: 2,
    })).toEqual({ ok: false, reason: 'The rail set move members are malformed.' });
    // Unbounded loopId.
    expect(actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'loop', loopId: 'x'.repeat(300) }],
      delta: 2,
    })).toEqual({ ok: false, reason: 'The rail set move members are malformed.' });
    // Non-integer delta.
    expect(actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12)],
      delta: 1.5,
    })).toEqual({ ok: false, reason: 'The rail set move delta is malformed.' });
  });

  it('threads the incoming break collection into a break-aware proposalVersion (Pitfall 3 regression)', () => {
    // Group-owned keys g0/g1 split the derived segments without any break; a
    // break on a group-owned key reaches the fingerprint without splitting
    // (deriveKeyRailSegments skips group-owned keys before the break check).
    const records = [
      realKeyRecord('A', 0), realKeyRecord('B', 1), realKeyRecord('C', 10), realKeyRecord('D', 11),
      realKeyRecord('g0', 20), realKeyRecord('g1', 21),
    ];
    const loopG = lifecycleGroup({
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      phaseOrigin: 20,
      originalEndExclusive: 28,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 28 })]),
    });
    const base = { records, loopClips: [loopG], capacity: 30 };
    const withoutBreaks = createHarness({ ...base });
    const withBreaks = createHarness({ ...base, incomingInterpolationBreakKeyIds: ['g0'] });

    const plain = withoutBreaks.actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C', 'D'] }],
      delta: 2,
    });
    const broken = withBreaks.actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C', 'D'] }],
      delta: 2,
    });

    expect(plain.ok).toBe(true);
    expect(broken.ok).toBe(true);
    if (!plain.ok || !broken.ok) throw new Error('Both move preparations must succeed');
    // Identical physical content except break authority produce different
    // proposalVersions — the break collection reaches the fingerprint (Pitfall 3).
    expect(plain.publication.proposalVersion).not.toBe(broken.publication.proposalVersion);
    // The added break on a group-owned key does not change the committed
    // mapping, so the version difference is attributable to break authority alone.
    expect(Object.fromEntries(plain.publication.proposal.mapping))
      .toEqual(Object.fromEntries(broken.publication.proposal.mapping));
  });

  it('rejects a zero-delta move with the no-change reason and no publication (D-13)', () => {
    const { actions } = createHarness({
      records: [realKeyRecord('A', 0), realKeyRecord('B', 10)],
      capacity: 14,
      // The break on B splits the derived segments into [A] and [B] so the
      // single-key member {A,[A]} matches exactly one segment.
      incomingInterpolationBreakKeyIds: ['B'],
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A'] }],
      delta: 0,
    });
    expect(preparation).toEqual({ ok: false, reason: 'This move would not change the timeline.' });
  });

  it('prepares a break-aware publication carrying proposal, intent, version, launch tuple, and presentation facts', () => {
    // A [12,24), B [24,40), C [40,89): three flush Key Rails split by the
    // breaks on b0 and c0 (deriveKeyRailSegments never splits on gaps).
    const records = [
      ...keyRailRecords('a', 12, 12),
      ...keyRailRecords('b', 24, 16),
      ...keyRailRecords('c', 40, 49),
    ];
    const { actions } = createHarness({
      records,
      capacity: 120,
      incomingInterpolationBreakKeyIds: ['b0', 'c0'],
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12), keyRailMember('b', 16), keyRailMember('c', 49)],
      delta: 12,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Three-rail move must prepare');
    const pub = preparation.publication;
    expect(pub.proposal.status.operationKind).toBe('move-rails');
    expect(pub.proposal.status.changed).toBe(true);
    expect(pub.intent).toEqual({
      kind: 'move-rails',
      members: [keyRailMember('a', 12), keyRailMember('b', 16), keyRailMember('c', 49)],
      delta: 12,
    });
    expect(pub.expectedLaunch).toEqual({ operationId: 'op-1', layerId: 'layer-1' });
    expect(typeof pub.proposalVersion).toBe('string');
    expect(pub.proposalVersion.length).toBeGreaterThan(0);
    // The clamped +12 delta commits (preview-is-the-commit, D-17).
    expect(Object.fromEntries(pub.proposal.mapping)).toMatchObject({
      a0: 24, a11: 35, b0: 36, b15: 51, c0: 52, c48: 100,
    });
    // Presentation facts: three moved Rails, clamped +12, set [12,89) → [24,100), gap [12,24).
    expect(pub.movedRailCount).toBe(3);
    expect(pub.clampedDeltaFrames).toBe(12);
    expect(pub.beforeRange).toEqual({ firstFrame: 12, lastFrame: 88 });
    expect(pub.afterRange).toEqual({ firstFrame: 24, lastFrame: 100 });
    expect(pub.gapIntervals).toEqual([{ start: 12, end: 24 }]);
    // Internal breaks travel with moved key identity (D-11).
    expect(pub.proposal.nextIncomingInterpolationBreakKeyIds).toEqual(['b0', 'c0']);
  });

  it('prepares a leftward publication whose presentation facts feed the locked mirror copy', () => {
    const records = [
      ...keyRailRecords('a', 12, 12),
      ...keyRailRecords('b', 24, 16),
      ...keyRailRecords('c', 40, 49),
    ];
    const { actions } = createHarness({
      records,
      capacity: 120,
      incomingInterpolationBreakKeyIds: ['b0', 'c0'],
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12), keyRailMember('b', 16), keyRailMember('c', 49)],
      delta: -12,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Leftward move must prepare');
    const pub = preparation.publication;
    expect(Object.fromEntries(pub.proposal.mapping)).toMatchObject({
      a0: 0, a11: 11, b0: 12, b15: 27, c0: 28, c48: 76,
    });
    expect(pub.movedRailCount).toBe(3);
    expect(pub.clampedDeltaFrames).toBe(-12);
    expect(pub.beforeRange).toEqual({ firstFrame: 12, lastFrame: 88 });
    expect(pub.afterRange).toEqual({ firstFrame: 0, lastFrame: 76 });
    expect(pub.gapIntervals).toEqual([{ start: 77, end: 89 }]);
    // The mapped accepted copy from the retained facts.
    expect(mapRotoRailSetMoveProductReason({
      kind: 'accepted',
      movedRailCount: pub.movedRailCount,
      signedDeltaFrames: pub.clampedDeltaFrames,
      afterRange: pub.afterRange,
      gapIntervals: pub.gapIntervals,
    })).toBe('Moved 3 Rails by 12 frames — set now frames 0–76. Gap left at frames 77–88.');
  });

  it('prepares a duplicated-placement-only publication with no gap intervals (D-11)', () => {
    const records = [realKeyRecord('g0', 20), realKeyRecord('g1', 21)];
    const loopG = lifecycleGroup({
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      phaseOrigin: 20,
      originalEndExclusive: 28,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 28 })]),
    });
    const loopD = lifecycleGroup({
      loopId: 'loop-D',
      placementStart: 2,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      mode: 'static',
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
    });
    const { actions } = createHarness({ records, loopClips: [loopD, loopG], capacity: 40 });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'loop', loopId: 'loop-D' }],
      delta: 5,
    });

    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Duplicated placement move must prepare');
    const pub = preparation.publication;
    // No physical keys move; the placement translates by the clamped delta.
    expect(Object.fromEntries(pub.proposal.mapping)).toEqual({ g0: 20, g1: 21 });
    expect(pub.proposal.status.changed).toBe(true);
    expect(pub.movedRailCount).toBe(1);
    expect(pub.clampedDeltaFrames).toBe(5);
    expect(pub.beforeRange).toEqual({ firstFrame: 2, lastFrame: 9 });
    expect(pub.afterRange).toEqual({ firstFrame: 7, lastFrame: 14 });
    // A duplicated placement opens no gap: its source keys stay (D-11).
    expect(pub.gapIntervals).toEqual([]);
    const moved = pub.proposal.nextLoopClips?.find((clip) => clip.loopId === 'loop-D');
    expect(moved?.placementStart).toBe(7);
  });

  it('fails closed with the no-space copy when the set is flush at capacity', () => {
    const { actions } = createHarness({
      records: keyRailRecords('k', 0, 10),
      capacity: 10,
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('k', 10)],
      delta: 2,
    });
    expect(preparation).toEqual({
      ok: false,
      reason: 'No empty space in that direction.',
      detail: expect.any(String),
    });
  });

  it('fails closed with the straddle copy when a selected Group shares its source with an unselected Group (D-10)', () => {
    const records = [realKeyRecord('g0', 20), realKeyRecord('g1', 21)];
    const loopG = lifecycleGroup({
      loopId: 'loop-G',
      placementStart: 20,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      phaseOrigin: 20,
      originalEndExclusive: 28,
      visibleRanges: Object.freeze([Object.freeze({ start: 20, endExclusive: 28 })]),
    });
    const loopD = lifecycleGroup({
      loopId: 'loop-D',
      placementStart: 2,
      sourceKeyIds: Object.freeze(['g0', 'g1']),
      mode: 'static',
      phaseOrigin: 2,
      originalEndExclusive: 10,
      visibleRanges: Object.freeze([Object.freeze({ start: 2, endExclusive: 10 })]),
    });
    const { actions } = createHarness({ records, loopClips: [loopD, loopG], capacity: 40 });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'loop', loopId: 'loop-G' }],
      delta: 5,
    });
    expect(preparation).toEqual({
      ok: false,
      reason: 'Can\'t move the selected Rails: a selected Group shares its source with an unselected Group.',
      detail: expect.any(String),
    });
  });

  it('maps the entire locked copy family verbatim (D-09/D-10/D-12, UI-SPEC M3/M6)', () => {
    // Live readout, rightward with gap — UI-SPEC M3 example shape.
    expect(mapRotoRailSetMoveProductReason({
      kind: 'live',
      signedDeltaFrames: 12,
      beforeRange: { firstFrame: 12, lastFrame: 88 },
      afterRange: { firstFrame: 24, lastFrame: 100 },
      gapIntervals: [{ start: 12, end: 24 }],
    })).toBe('Move Rails +12 — set frames 12–88 → 24–100, gap 12–23');
    // Live readout, leftward mirror (U+2212 MINUS SIGN).
    expect(mapRotoRailSetMoveProductReason({
      kind: 'live',
      signedDeltaFrames: -8,
      beforeRange: { firstFrame: 8, lastFrame: 17 },
      afterRange: { firstFrame: 0, lastFrame: 9 },
      gapIntervals: [{ start: 8, end: 16 }],
    })).toBe('Move Rails −8 — set frames 8–17 → 0–9, gap 8–15');
    // Live readout with no gap: no gap sentence.
    expect(mapRotoRailSetMoveProductReason({
      kind: 'live',
      signedDeltaFrames: 5,
      beforeRange: { firstFrame: 2, lastFrame: 9 },
      afterRange: { firstFrame: 7, lastFrame: 14 },
      gapIntervals: [],
    })).toBe('Move Rails +5 — set frames 2–9 → 7–14');
    // Accepted plural with gap.
    expect(mapRotoRailSetMoveProductReason({
      kind: 'accepted',
      movedRailCount: 3,
      signedDeltaFrames: 12,
      afterRange: { firstFrame: 24, lastFrame: 100 },
      gapIntervals: [{ start: 12, end: 24 }],
    })).toBe('Moved 3 Rails by 12 frames — set now frames 24–100. Gap left at frames 12–23.');
    // Accepted singular with gap.
    expect(mapRotoRailSetMoveProductReason({
      kind: 'accepted',
      movedRailCount: 1,
      signedDeltaFrames: 8,
      afterRange: { firstFrame: 8, lastFrame: 17 },
      gapIntervals: [{ start: 0, end: 8 }],
    })).toBe('Moved 1 Rail by 8 frames — set now frames 8–17. Gap left at frames 0–7.');
    // Accepted without gap (duplicated-placement-only set opens no gap).
    expect(mapRotoRailSetMoveProductReason({
      kind: 'accepted',
      movedRailCount: 1,
      signedDeltaFrames: 5,
      afterRange: { firstFrame: 7, lastFrame: 14 },
      gapIntervals: [],
    })).toBe('Moved 1 Rail by 5 frames — set now frames 7–14.');
    // Disabled pass-through.
    expect(mapRotoRailSetMoveProductReason({ kind: 'disabled', reason: 'A Roto physical edit is already in flight.' }))
      .toBe('A Roto physical edit is already in flight.');
    // Straddle verbatim (D-10).
    expect(mapRotoRailSetMoveProductReason({ kind: 'rejected', failureCode: 'move-rails-source-straddle', failureText: 'x' }))
      .toBe('Can\'t move the selected Rails: a selected Group shares its source with an unselected Group.');
    // No-space delegates to the Group mapper — one literal source (43.4 precedent).
    expect(mapRotoRailSetMoveProductReason({ kind: 'rejected', failureCode: 'no-free-space-in-direction', failureText: 'z' }))
      .toBe('No empty space in that direction.');
  });
});

describe('useRotoTimelineActions batch Move commit + stale authority (43.6-03 Task 2)', () => {
  it('commits the exact retained move-rails publication once and publishes accepted copy from the continuation', async () => {
    const records = [
      ...keyRailRecords('a', 12, 12),
      ...keyRailRecords('b', 24, 16),
      ...keyRailRecords('c', 40, 49),
    ];
    const { actions, executePhysicalEdit, publishStatus } = createHarness({
      records,
      capacity: 120,
      incomingInterpolationBreakKeyIds: ['b0', 'c0'],
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12), keyRailMember('b', 16), keyRailMember('c', 49)],
      delta: 12,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Three-rail move must prepare');

    const accepted = await actions.physicalActions.commitRailSetMove(preparation.publication);

    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
    const dispatched = executePhysicalEdit.mock.calls[0][0] as unknown as {
      proposal: unknown;
      expectedLaunch: unknown;
      operationKind: string;
      intent: unknown;
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.expectedLaunch).toBe(preparation.publication.expectedLaunch);
    expect(dispatched.operationKind).toBe('move-rails');
    expect(dispatched.intent).toBe(preparation.publication.intent);
    expect(dispatched.selectedKeyId).toBe(preparation.publication.proposal.selectedKeyId);
    expect(dispatched.selectedAppFrame).toBe(preparation.publication.proposal.selectedAppFrame);
    // Accepted copy publishes from the .then continuation — never runPhysicalAction.
    expect(publishStatus).toHaveBeenCalledWith(
      'Moved 3 Rails by 12 frames — set now frames 24–100. Gap left at frames 12–23.',
    );
  });

  it('rejects a mismatched or empty-launch publication without dispatching (wrapper coherence)', async () => {
    const records = [
      ...keyRailRecords('a', 12, 12),
      ...keyRailRecords('b', 24, 16),
      ...keyRailRecords('c', 40, 49),
    ];
    const { actions, executePhysicalEdit } = createHarness({
      records,
      capacity: 120,
      incomingInterpolationBreakKeyIds: ['b0', 'c0'],
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [keyRailMember('a', 12), keyRailMember('b', 16), keyRailMember('c', 49)],
      delta: 12,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Three-rail move must prepare');
    const publication = preparation.publication;

    const kindMismatch = {
      ...publication,
      proposal: {
        ...publication.proposal,
        status: { ...publication.proposal.status, operationKind: 'move-group' as const },
      },
    };
    expect(await actions.physicalActions.commitRailSetMove(kindMismatch)).toBe(false);

    const intentMismatch = {
      ...publication,
      intent: { ...publication.intent, kind: 'move-group' as const },
    } as unknown as import('./useRotoTimelineActions').RotoRailSetMovePublication;
    expect(await actions.physicalActions.commitRailSetMove(intentMismatch)).toBe(false);

    const emptyLaunch = { ...publication, expectedLaunch: { operationId: '', layerId: '' } };
    expect(await actions.physicalActions.commitRailSetMove(emptyLaunch)).toBe(false);

    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });

  it('rejects a stale break-aware proposal version with zero mutation (T-43.6-02)', async () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1), realKeyRecord('C', 10), realKeyRecord('D', 11)];
    // The break on C splits the derived segments into [A,B] and [C,D] so the
    // member {A,[A,B]} matches exactly one segment.
    const breaks = ['C'];
    const { actions, executePhysicalEdit } = createHarness({
      records,
      capacity: 14,
      getIncomingInterpolationBreakKeyIds: () => breaks,
    });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B'] }],
      delta: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Move must prepare');

    // A concurrent Scissor edit changes ONLY the break collection after prepare.
    breaks.push('A');

    expect(await actions.physicalActions.commitRailSetMove(preparation.publication)).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
    expect(breaks).toEqual(['C', 'A']);
  });

  it('rejects a stale structural authority with zero mutation (concurrent key edit)', async () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1)];
    const { actions, executePhysicalEdit } = createHarness({ records, capacity: 14 });
    const preparation = actions.physicalActions.prepareRailSetMove({
      members: [{ kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B'] }],
      delta: 2,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Move must prepare');

    records.push(realKeyRecord('new-authority', 12));

    expect(await actions.physicalActions.commitRailSetMove(preparation.publication)).toBe(false);
    expect(executePhysicalEdit).not.toHaveBeenCalled();
  });
});

describe('useRotoTimelineActions Push from cell anchors (43.5-05 smoke RED)', () => {
  it('commits a Push Left from a generated-frame cell anchor through the real pipeline', async () => {
    // A@2, B@5: generated in-between frames 3-4. Frame 3 is a NON-EMPTY cell
    // (generated) that must resolve to its containing Key Rail's first key (A).
    const records = [realKeyRecord('A', 2), realKeyRecord('B', 5)];
    const { actions, executePhysicalEdit } = createHarness({ records, capacity: 10 });
    const anchor = resolvePhysicPaintPushAnchor(3, {
      keyIdByAppFrame: new Map([[2, 'A'], [5, 'B']]),
      loopIdByAppFrame: new Map(),
      keyRailSegments: [{ firstKeyId: 'A', keyIds: ['A', 'B'], firstKeyFrame: 2, lastKeyFrame: 5 }],
    });
    expect(anchor).toEqual({ kind: 'key', id: 'A' });

    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'left',
      anchorKeyId: anchor!.id,
      deltaFrames: 1,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push Left from generated cell must prepare');
    const accepted = await actions.physicalActions.commitRotoPush(preparation.publication);
    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
  });

  it('commits a Push Right from a Key Rail member anchor through the real pipeline', async () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 1), realKeyRecord('C', 2)];
    const { actions, executePhysicalEdit } = createHarness({ records, capacity: 10 });
    const anchor = resolvePhysicPaintPushAnchor(1, {
      keyIdByAppFrame: new Map([[0, 'A'], [1, 'B'], [2, 'C']]),
      loopIdByAppFrame: new Map(),
      keyRailSegments: [{ firstKeyId: 'A', keyIds: ['A', 'B', 'C'], firstKeyFrame: 0, lastKeyFrame: 2 }],
    });
    expect(anchor).toEqual({ kind: 'key', id: 'B' });

    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'right',
      anchorKeyId: anchor!.id,
      deltaFrames: 1,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push Right from Key Rail member must prepare');
    const accepted = await actions.physicalActions.commitRotoPush(preparation.publication);
    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
  });

  it('commits a Push Left with empty space at frame 0 through the real pipeline (discrimination case B)', async () => {
    // A [5,15), B [20,30), C [40,50): the suffix set (B + C) has room to move
    // left, clamped at A's end (15). Push Left 5 must prepare and commit —
    // proving the left clamp scans the correct direction and the negative delta
    // sign survives prepare.
    const records = [
      realKeyRecord('a0', 5), realKeyRecord('a1', 6), realKeyRecord('a2', 7), realKeyRecord('a3', 8),
      realKeyRecord('a4', 9), realKeyRecord('a5', 10), realKeyRecord('a6', 11), realKeyRecord('a7', 12),
      realKeyRecord('a8', 13), realKeyRecord('a9', 14),
      realKeyRecord('b0', 20), realKeyRecord('b1', 21), realKeyRecord('b2', 22), realKeyRecord('b3', 23),
      realKeyRecord('b4', 24), realKeyRecord('b5', 25), realKeyRecord('b6', 26), realKeyRecord('b7', 27),
      realKeyRecord('b8', 28), realKeyRecord('b9', 29),
      realKeyRecord('c0', 40), realKeyRecord('c1', 41), realKeyRecord('c2', 42), realKeyRecord('c3', 43),
      realKeyRecord('c4', 44), realKeyRecord('c5', 45), realKeyRecord('c6', 46), realKeyRecord('c7', 47),
      realKeyRecord('c8', 48), realKeyRecord('c9', 49),
    ];
    const { actions, executePhysicalEdit } = createHarness({
      records,
      capacity: 60,
      getIncomingInterpolationBreakKeyIds: () => ['b0', 'c0'],
    });
    const preparation = actions.physicalActions.prepareRotoPush({
      direction: 'left',
      anchorKeyId: 'b0',
      deltaFrames: 5,
    });
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) throw new Error('Push Left with empty frame 0 must prepare');
    const accepted = await actions.physicalActions.commitRotoPush(preparation.publication);
    expect(accepted).toBe(true);
    expect(executePhysicalEdit).toHaveBeenCalledTimes(1);
  });
});

describe('useRotoTimelineActions set-copy mapper family (43.6-01 Task 3, D-27)', () => {
  const keyRail = (firstFrame: number, effectiveEndExclusive: number) => ({
    kind: 'key-rail' as const,
    firstFrame,
    effectiveEndExclusive,
  });
  const motionLoop = (firstFrame: number, effectiveEndExclusive: number) => ({
    kind: 'loop' as const,
    firstFrame,
    effectiveEndExclusive,
    mode: 'progressive' as const,
  });
  const staticLoop = (firstFrame: number, effectiveEndExclusive: number) => ({
    kind: 'loop' as const,
    firstFrame,
    effectiveEndExclusive,
    mode: 'static' as const,
  });

  it('produces the locked homogeneous copy with the type name and en-dash range', () => {
    expect(buildRailSetCopy([
      keyRail(12, 20),
      keyRail(30, 41),
    ])).toBe('2 Key Rails selected — frames 12–40.');
  });

  it('produces the locked mixed copy with the type breakdown in first-frame order', () => {
    expect(buildRailSetCopy([
      motionLoop(12, 40),
      keyRail(50, 70),
      keyRail(75, 89),
    ])).toBe('3 Rails selected — frames 12–88 (1 Motion, 2 Key).');
  });

  it('produces the locked set-of-one copy without a type breakdown', () => {
    expect(buildRailSetCopy([
      staticLoop(12, 41),
    ])).toBe('1 Rail selected — frames 12–40.');
  });

  it('produces no copy for the empty set', () => {
    expect(buildRailSetCopy([])).toBeNull();
  });

  it('names homogeneous Motion and Static loop sets by their rail type', () => {
    expect(buildRailSetCopy([
      motionLoop(12, 20),
      motionLoop(30, 41),
    ])).toBe('2 Motion Rails selected — frames 12–40.');
    expect(buildRailSetCopy([
      staticLoop(12, 20),
      staticLoop(30, 41),
    ])).toBe('2 Static Rails selected — frames 12–40.');
  });

  it('derives the inclusive frame range from canonical half-open intervals', () => {
    // A = first member first frame; B = last member effective end minus 1.
    expect(buildRailSetCopy([
      keyRail(4, 9),
      keyRail(12, 17),
    ])).toBe('2 Key Rails selected — frames 4–16.');
  });

  it('uses correct singular/plural type terms in the mixed breakdown', () => {
    expect(buildRailSetCopy([
      staticLoop(12, 40),
      keyRail(50, 70),
      keyRail(75, 89),
    ])).toBe('3 Rails selected — frames 12–88 (1 Static, 2 Key).');
    expect(buildRailSetCopy([
      motionLoop(12, 40),
      staticLoop(50, 70),
      keyRail(75, 89),
    ])).toBe('3 Rails selected — frames 12–88 (1 Motion, 1 Static, 1 Key).');
  });

  it('builds the M1 tooltip set sentences with the anchor prefix', () => {
    expect(buildRailSetTooltipSentence(3, false)).toBe(' One of 3 selected Rails — drag moves the set, Delete removes the set.');
    expect(buildRailSetTooltipSentence(3, true)).toBe(' Range anchor. One of 3 selected Rails — drag moves the set, Delete removes the set.');
    expect(buildRailSetTooltipSentence(0, false)).toBeNull();
  });
});

describe('useRotoTimelineActions solo capsule mapper (43.6-06 Task 3, D-20/D-27)', () => {
  const keyRail = (firstFrame: number, effectiveEndExclusive: number) => ({
    kind: 'key-rail' as const,
    firstFrame,
    effectiveEndExclusive,
  });
  const motionLoop = (firstFrame: number, effectiveEndExclusive: number) => ({
    kind: 'loop' as const,
    firstFrame,
    effectiveEndExclusive,
    mode: 'progressive' as const,
  });

  it('produces the locked mixed solo line with the ASCII-hyphen range', () => {
    expect(buildRailSetSoloCopy([
      motionLoop(12, 40),
      keyRail(50, 70),
      keyRail(75, 89),
    ])).toBe('Solo - 3 Rails, frames 12-88.');
  });

  it('produces the locked singular solo line for a set of one', () => {
    expect(buildRailSetSoloCopy([
      keyRail(12, 41),
    ])).toBe('Solo - 1 Rail, frames 12-40.');
  });

  it('derives the inclusive frame range from canonical half-open intervals', () => {
    // A = first member first frame; B = last member effective end minus 1.
    expect(buildRailSetSoloCopy([
      keyRail(4, 9),
      keyRail(12, 17),
    ])).toBe('Solo - 2 Rails, frames 4-16.');
  });

  it('produces no solo line for the empty set', () => {
    expect(buildRailSetSoloCopy([])).toBeNull();
  });
});
