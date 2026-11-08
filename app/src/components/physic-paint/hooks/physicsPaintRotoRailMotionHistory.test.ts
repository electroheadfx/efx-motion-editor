import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoRailMotionRecord } from '../roto/railMotionModel';
import type {
  RotoPhysicalEditAcceptedOutput,
  RotoPhysicalEditExecuteInput,
  RotoPhysicalEditSnapshot,
} from '../roto/rotoCoordinatorPorts';
import { snapshotRevision, useRotoPhysicalEditHistory } from './useRotoPhysicalEditHistory';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

// 59-07 Task 2 (MOTN-12): motion rides the SAME history snapshot as drawing keys
// and Loop Clips. These specs mirror `physicsPaintRotoLoopHistory.test.ts` and
// prove a motion-only difference is recorded, undone and redone.

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes('iVBORw0KGgo='),
    },
  };
}

function railMotion(railId: string, value: number): PhysicPaintRotoRailMotionRecord {
  return {
    railId,
    anchorKeyId: 'A',
    channels: [
      { id: 'opacity', wiggle: 0, wiggleGlobal: true, keys: [{ frame: 0, value, easing: 'ease', wiggle: 0 }] },
    ],
  };
}

const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

function snapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  railMotions: readonly PhysicPaintRotoRailMotionRecord[],
  selectedKeyId: string | null = null,
  selectedAppFrame: number | null = null,
): RotoPhysicalEditSnapshot<null> {
  const revision = buildPhysicPaintRotoPhysicalRevision(
    records,
    INTERPOLATION,
    [],
    [],
    [],
    railMotions,
  );
  return {
    launchOperationId: 'launch-1',
    layerId: 'layer-1',
    projectContextId: 'project-1',
    records,
    groupOverrideRecords: [],
    interpolation: INTERPOLATION,
    loopClips: [],
    railMotions,
    incomingInterpolationBreakKeyIds: [],
    capacity: 10,
    expectedRevision: revision,
    stagedRevision: revision,
    selectedKeyId,
    selectedAppFrame,
    currentAppFrame: selectedAppFrame ?? 0,
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

function harness(initial: RotoPhysicalEditSnapshot<null>) {
  const acceptedOutput = signal<RotoPhysicalEditAcceptedOutput<null> | null>(null);
  const pendingOperationId = signal<string | null>(null);
  const availability = signal({ undo: 0, redo: 0 });
  let current = initial;
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
      acceptedRevision: snapshotRevision(target),
      operationId: `replay-${replayNumber}`,
      operationKind: input.operationKind,
      historyProvenance: input.historyProvenance,
    };
    return true;
  });

  const historyInput = {
    identity: {
      launchOperationId: 'launch-1',
      layerId: 'layer-1',
      projectContextId: 'project-1',
      capacity: 10,
      trackId: 'track-a',
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
      raiseCapacity: () => {},
      getLoopClips: () => current.loopClips,
      getRailMotions: () => current.railMotions,
      getIncomingInterpolationBreakKeyIds: () => current.incomingInterpolationBreakKeyIds,
      replaceIncomingInterpolationBreakKeyIds: () => ({ ok: true as const }),
      replaceRecords: () => ({ ok: true as const }),
      replaceLoopClips: () => ({ ok: true as const }),
    },
    getLiveSourceSnapshot: () => current,
    undoPaint: () => false,
    redoPaint: () => false,
  };
  const history = useRotoPhysicalEditHistory(
    historyInput as Parameters<typeof useRotoPhysicalEditHistory<null>>[0],
  );

  const accept = (
    before: RotoPhysicalEditSnapshot<null>,
    after: RotoPhysicalEditSnapshot<null>,
    operationId: string,
    operationKind: RotoPhysicalEditAcceptedOutput<null>['operationKind'] = 'move-key',
  ) => {
    current = after;
    acceptedOutput.value = {
      before,
      after,
      acceptedRevision: snapshotRevision(after),
      operationId,
      operationKind,
      historyProvenance: null,
    };
  };

  return { history, availability, executePhysicalEdit, accept, getCurrent: () => current };
}

const SOURCE_RECORDS = () => [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 4)];

describe('59-07: railMotions canonical revision fingerprint', () => {
  it('produces different revisions for documents identical in keys but differing in one motion value', () => {
    const records = SOURCE_RECORDS();
    const base = buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], [railMotion('rail-1', 0.25)]);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], [railMotion('rail-1', 0.5)])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], [railMotion('rail-2', 0.25)])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], [])).not.toBe(base);
    // Canonically identical content produces the identical revision.
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], [], [], [railMotion('rail-1', 0.25)])).toBe(base);
  });
});

describe('59-07: motion-only edit history (MOTN-12)', () => {
  it('records one command for a motion-only change; Undo restores the prior collection and Redo restores the edit', async () => {
    const before = snapshot(SOURCE_RECORDS(), [railMotion('rail-1', 0.25)]);
    const after = snapshot(SOURCE_RECORDS(), [railMotion('rail-1', 0.75)]);
    const test = harness(after);

    test.accept(before, after, 'animate-rail-1');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await test.history.undo()).toBe(true);
    expect(test.getCurrent().railMotions).toHaveLength(1);
    expect(test.getCurrent().railMotions[0].channels[0].keys[0].value).toBe(0.25);
    expect(test.getCurrent().records).toHaveLength(5);
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await test.history.redo()).toBe(true);
    expect(test.getCurrent().railMotions[0].channels[0].keys[0].value).toBe(0.75);
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    expect(test.executePhysicalEdit).toHaveBeenCalledTimes(2);
    const [undoCall, redoCall] = test.executePhysicalEdit.mock.calls.map(([input]) => input);
    expect(undoCall.operationKind).toBe('undo');
    expect(redoCall.operationKind).toBe('redo');
    // The replay target IS the snapshot: motion rides it, so no separate channel
    // can be silently dropped on replay.
    expect(undoCall.replayTargetSnapshot?.railMotions).toEqual(before.railMotions);
    expect(redoCall.replayTargetSnapshot?.railMotions).toEqual(after.railMotions);

    const beforeRevision = snapshotRevision(before);
    const afterRevision = snapshotRevision(after);
    expect(beforeRevision).not.toBe(afterRevision);
    expect(undoCall.historyProvenance).toEqual({
      historyCommandId: 'animate-rail-1',
      historyDirection: 'undo',
      sourceRevision: afterRevision,
      targetRevision: beforeRevision,
    });
    expect(redoCall.historyProvenance).toEqual({
      historyCommandId: 'animate-rail-1',
      historyDirection: 'redo',
      sourceRevision: beforeRevision,
      targetRevision: afterRevision,
    });
  });

  it('treats an equal collection with different array identity as a no-op and a different collection as a change', () => {
    const base = snapshot(SOURCE_RECORDS(), [railMotion('rail-1', 0.25)]);
    // Same canonical content, fresh array/record references (a clone round-trip).
    const cloned = {
      ...base,
      railMotions: [railMotion('rail-1', 0.25)],
      expectedRevision: 'derived-stale',
      stagedRevision: 'derived-stale',
      currentAppFrame: 7,
    } as RotoPhysicalEditSnapshot<null>;
    const test = harness(base);

    test.accept(base, cloned, 'motion-noop');
    expect(test.availability.value).toEqual({ undo: 0, redo: 0 });

    const changed = { ...base, railMotions: [railMotion('rail-1', 0.5)] } as RotoPhysicalEditSnapshot<null>;
    test.accept(base, changed, 'motion-change');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
  });

  it('a motion-only difference leaves every key-derived field identical', async () => {
    const before = snapshot(SOURCE_RECORDS(), [railMotion('rail-1', 0.25)]);
    const after = { ...before, railMotions: [railMotion('rail-1', 0.75)] } as RotoPhysicalEditSnapshot<null>;
    const test = harness(after);

    test.accept(before, after, 'motion-only');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    await test.history.undo();
    const current = test.getCurrent();
    expect(current.records).toEqual(before.records);
    expect(current.groupOverrideRecords).toEqual(before.groupOverrideRecords);
    expect(current.interpolation).toEqual(before.interpolation);
    expect(current.loopClips).toEqual(before.loopClips);
    expect(current.incomingInterpolationBreakKeyIds).toEqual(before.incomingInterpolationBreakKeyIds);
    expect(current.selectedKeyId).toBe(before.selectedKeyId);
    expect(current.selectedAppFrame).toBe(before.selectedAppFrame);
    expect(current.railMotions[0].channels[0].keys[0].value).toBe(0.25);
  });

  it('requires railMotions on every snapshot literal', () => {
    const base = snapshot(SOURCE_RECORDS(), [railMotion('rail-1', 0.25)]);
    const { railMotions: omitted, ...withoutMotion } = base;
    expect(omitted).toHaveLength(1);
    // @ts-expect-error railMotions is a REQUIRED snapshot member: an absent
    // field must not compile, so no operator can silently drop motion on replay.
    const missing: RotoPhysicalEditSnapshot<null> = withoutMotion;
    expect(missing.launchOperationId).toBe('launch-1');
  });
});
