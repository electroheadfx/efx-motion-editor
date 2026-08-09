import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintRotoFrameResolution,
  PhysicPaintRotoPhysicalCell,
} from '../roto/physicsPaintRotoPhysicalResolver';
import {
  getPhysicsPaintRotoSourceCycleId,
  togglePhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingSelection,
} from '../roto/physicsPaintRotoSpacingSelection';
import { useRotoTimelineActions, type RotoTimelineActionsInput } from './useRotoTimelineActions';

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

interface HarnessOptions {
  records?: PhysicPaintRotoRealKeyRecord[];
  loopClips?: readonly PhysicPaintRotoLoopClip[];
  spacingSelection?: PhysicsPaintRotoSpacingSelection | null;
  physicalCells?: readonly PhysicPaintRotoPhysicalCell[];
  frameResolution?: PhysicPaintRotoFrameResolution;
  currentAppFrame?: number;
  launch?: PhysicPaintLaunchContext | null;
  pendingOperationId?: string | null;
  selectedKeyId?: string | null;
  selectedKeyIds?: readonly string[];
  selectedLoopClipIds?: readonly string[];
  incomingInterpolationBreakKeyIds?: readonly string[];
  capacity?: number;
  blankDataUrl?: string;
}

function createHarness(options: HarnessOptions = {}) {
  const records = options.records ?? [];
  const launch = options.launch === undefined
    ? ({ operationId: 'op-1', layerId: 'layer-1' } as PhysicPaintLaunchContext)
    : options.launch;
  const publishStatus = vi.fn();
  const executePhysicalEdit = vi.fn(async (_input: unknown) => true);
  const pendingOperationId = signal<string | null>(options.pendingOperationId ?? null);
  const input: RotoTimelineActionsInput = {
    getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
    getRotoKeyRecords: () => records,
    getRotoInterpolationState: () => ({ enabled: false, mode: 'duplicate' }),
    getRotoLoopClips: () => options.loopClips ?? [],
    getRotoSpacingSelection: () => options.spacingSelection ?? null,
    getPhysicalCells: () => options.physicalCells ?? [],
    getFrameResolution: () => options.frameResolution ?? { kind: 'empty' },
    getSelectedKeyId: () => options.selectedKeyId ?? null,
    getSelectedKeyIds: () => options.selectedKeyIds ?? options.spacingSelection?.selectedSourceKeyIds ?? [],
    getSelectedLoopClipIds: () => options.selectedLoopClipIds ?? [],
    getCurrentAppFrame: () => options.currentAppFrame ?? 3,
    getLaunchContext: () => launch,
    getCapacity: () => options.capacity ?? 10,
    getIncomingInterpolationBreakKeyIds: () => options.incomingInterpolationBreakKeyIds ?? [],
    buildBlankRotoFrame: (appFrame) => ({
      frameIndex: 0,
      appFrame,
      dataUrl: options.blankDataUrl ?? BLANK_PNG_DATA_URL,
      width: 100,
      height: 80,
      source: 'real-key',
    }),
    executePhysicalEdit: executePhysicalEdit as never,
    pendingOperationId,
    publishStatus,
  };
  const actions = useRotoTimelineActions(input);
  return { actions, executePhysicalEdit, publishStatus, pendingOperationId };
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
    expect(occupied.executePhysicalEdit.mock.calls[0][0]).toMatchObject({ operationKind: 'insert-slot' });
    expect(occupied.publishStatus).toHaveBeenCalledWith('Inserted an empty Roto frame before the selected key.');

    const predecessorDataUrl = 'data:image/png;base64,PREDECESSOR';
    const records = [
      Object.freeze({
        ...realKeyRecord('key-before', 1),
        payload: Object.freeze({ ...blankPayload(1), dataUrl: predecessorDataUrl }),
      }) as PhysicPaintRotoRealKeyRecord,
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
      incomingInterpolationBreakKeyIds: ['key-before'],
    });

    expect(empty.actions.physicalActions.canInsertFrame.value).toBe(true);
    expect(empty.actions.physicalActions.insertTooltipDescription.value).toBe(
      'Insert an empty key and start a new interpolation segment.',
    );
    expect(await empty.actions.physicalActions.insertRotoFrame()).toBe(true);
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
    expect(dispatched.proposal.nextRecords).toHaveLength(2);
    const inserted = dispatched.proposal.nextRecords.find((record) => record.keyId === dispatched.proposal.selectedKeyId);
    expect(inserted?.payload.dataUrl).toBe(BLANK_PNG_DATA_URL);
    expect(inserted?.payload.dataUrl).not.toBe(predecessorDataUrl);
    expect(dispatched.proposal.nextIncomingInterpolationBreakKeyIds).toEqual([
      'key-before',
      dispatched.proposal.selectedKeyId,
    ]);
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
    };
    expect(dispatched.operationKind).toBe('force-spacing');
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
      selectedKeyId: string | null;
      selectedAppFrame: number | null;
    };
    expect(dispatched.proposal).toBe(preparation.publication.proposal);
    expect(dispatched.operationKind).toBe('move-key-group');
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
