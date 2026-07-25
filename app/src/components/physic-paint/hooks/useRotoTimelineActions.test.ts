import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
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
  currentAppFrame?: number;
  launch?: PhysicPaintLaunchContext | null;
  pendingOperationId?: string | null;
}

function createHarness(options: HarnessOptions = {}) {
  const records = options.records ?? [];
  const launch = options.launch === undefined
    ? ({ operationId: 'op-1', layerId: 'layer-1' } as PhysicPaintLaunchContext)
    : options.launch;
  const publishStatus = vi.fn();
  const executePhysicalEdit = vi.fn(async () => true);
  const pendingOperationId = signal<string | null>(options.pendingOperationId ?? null);
  const input: RotoTimelineActionsInput = {
    getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
    getRotoKeyRecords: () => records,
    getRotoInterpolationState: () => ({ enabled: false, mode: 'duplicate' }),
    getPhysicalCells: () => [],
    getSelectedKeyId: () => null,
    getCurrentAppFrame: () => options.currentAppFrame ?? 3,
    getLaunchContext: () => launch,
    getCapacity: () => 10,
    executePhysicalEdit: executePhysicalEdit as never,
    pendingOperationId,
    publishStatus,
  };
  const actions = useRotoTimelineActions(input);
  return { actions, executePhysicalEdit, publishStatus, pendingOperationId };
}

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
