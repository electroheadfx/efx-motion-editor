import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import type { PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';
import { useRotoPhysicalEditHistory } from './useRotoPhysicalEditHistory';

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

function snapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  selectedKeyId: string,
  selectedAppFrame: number,
): RotoPhysicalEditSnapshot<null> {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, { enabled: false, mode: 'duplicate' }, []);
  return {
    launchOperationId: 'launch-1',
    layerId: 'layer-1',
    projectContextId: 'project-1',
    records,
    interpolation: { enabled: false, mode: 'duplicate' },
    loopClips: [],
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
        acceptedRevision: buildPhysicPaintRotoPhysicalRevision(target.records, target.interpolation, target.loopClips),
        operationId: `replay-${replayNumber}`,
        operationKind: input.operationKind,
        historyProvenance: input.historyProvenance,
      };
      return true;
    });

    const history = useRotoPhysicalEditHistory({
      identity: { launchOperationId: 'launch-1', layerId: 'layer-1' },
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
        replaceLoopClips: () => ({ ok: true }),
        replaceRecords: () => ({ ok: true }),
      },
      undoPaint: () => false,
      redoPaint: () => false,
    });

    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(after.records, after.interpolation, after.loopClips),
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
