import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useEffect: (setup: () => void | (() => void)) => setup(),
  useRef: <Value>(value: Value) => ({ current: value }),
}));

import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
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

function loopClip(loopId: string, repeat: number | 'infinity', placementStart = 0): PhysicPaintRotoLoopClip {
  return {
    loopId,
    placementStart,
    sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
    repeat,
    mode: 'progressive',
  };
}

const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

function snapshot(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loopClips: readonly PhysicPaintRotoLoopClip[],
  selectedKeyId: string | null = null,
  selectedAppFrame: number | null = null,
): RotoPhysicalEditSnapshot<null> {
  const revision = buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips);
  return {
    launchOperationId: 'launch-1',
    layerId: 'layer-1',
    projectContextId: 'project-1',
    records,
    interpolation: INTERPOLATION,
    loopClips,
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
      replaceRecords: () => ({ ok: true as const }),
      replaceLoopClips: () => ({ ok: true as const }),
    },
    undoPaint: () => false,
    redoPaint: () => false,
  });

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
      acceptedRevision: buildPhysicPaintRotoPhysicalRevision(after.records, after.interpolation, after.loopClips),
      operationId,
      operationKind,
      historyProvenance: null,
    };
  };

  return { history, availability, executePhysicalEdit, accept, getCurrent: () => current };
}

const SOURCE_RECORDS = () => [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 4)];

describe('loopClips canonical revision fingerprint (Q1)', () => {
  it('produces different revisions for documents identical in records and interpolation but differing in one loop repeat', () => {
    const records = SOURCE_RECORDS();
    const base = buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-1', 5)]);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-1', 9)])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-1', 'infinity')])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-2', 5)])).not.toBe(base);
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-1', 5, 40)])).not.toBe(base);
    // Identical canonical content produces the identical revision.
    expect(buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [loopClip('loop-1', 5)])).toBe(base);
  });
});

describe('loop-only edit history (D-10)', () => {
  it('records one command for a loop-only Repeat change; Undo restores the prior repeat exactly and Redo re-applies it exactly', async () => {
    const before = snapshot(SOURCE_RECORDS(), [loopClip('loop-1', 5)]);
    const after = snapshot(SOURCE_RECORDS(), [loopClip('loop-1', 9)]);
    const test = harness(after);

    test.accept(before, after, 'update-loop-1');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await test.history.undo()).toBe(true);
    expect(test.getCurrent().loopClips[0].repeat).toBe(5);
    expect(test.getCurrent().records).toHaveLength(5);
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await test.history.redo()).toBe(true);
    expect(test.getCurrent().loopClips[0].repeat).toBe(9);
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    expect(test.executePhysicalEdit).toHaveBeenCalledTimes(2);
    const [undoCall, redoCall] = test.executePhysicalEdit.mock.calls.map(([input]) => input);
    expect(undoCall.operationKind).toBe('undo');
    expect(redoCall.operationKind).toBe('redo');
    // Replay provenance revisions cover the loop-only change in both directions.
    const beforeRevision = buildPhysicPaintRotoPhysicalRevision(before.records, before.interpolation, before.loopClips);
    const afterRevision = buildPhysicPaintRotoPhysicalRevision(after.records, after.interpolation, after.loopClips);
    expect(beforeRevision).not.toBe(afterRevision);
    expect(undoCall.historyProvenance).toEqual({
      historyCommandId: 'update-loop-1',
      historyDirection: 'undo',
      sourceRevision: afterRevision,
      targetRevision: beforeRevision,
    });
    expect(redoCall.historyProvenance).toEqual({
      historyCommandId: 'update-loop-1',
      historyDirection: 'redo',
      sourceRevision: beforeRevision,
      targetRevision: afterRevision,
    });
  });

  it('does not record a command when only derived/untracked snapshot state differs, but records one when loopClips differ', () => {
    const loops = [loopClip('loop-1', 5)];
    const base = snapshot(SOURCE_RECORDS(), loops);
    const derivedOnly = {
      ...base,
      expectedRevision: 'derived-stale',
      stagedRevision: 'derived-stale',
      currentAppFrame: 7,
    } as RotoPhysicalEditSnapshot<null>;
    const test = harness(base);

    // Derived-only difference: no durable change, no history command.
    test.accept(base, derivedOnly, 'noop-1');
    expect(test.availability.value).toEqual({ undo: 0, redo: 0 });

    // loopClips difference: one command even with identical records.
    const changed = snapshot(SOURCE_RECORDS(), [loopClip('loop-1', 3)]);
    test.accept(base, changed, 'update-loop-2');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
  });
});

describe('generation plus derived loop shrink is one undoable outcome (D-06)', () => {
  it('one Undo removes the generated keys and restores the loop canonical state; one Redo restores both', async () => {
    const before = snapshot(SOURCE_RECORDS(), [loopClip('loop-1', 5)]);
    // Batch generation landed three new real keys inside the loop's requested
    // range. The loop RECORD is unchanged — the shrink itself is derived —
    // so restoring the document snapshot restores the effective range.
    const after = snapshot(
      [...SOURCE_RECORDS(), record('G1', 5), record('G2', 6), record('G3', 7)],
      [loopClip('loop-1', 5)],
    );
    const test = harness(after);

    test.accept(before, after, 'play-script-1', 'play-script');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });

    expect(await test.history.undo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(test.getCurrent().loopClips[0].repeat).toBe(5);
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });

    expect(await test.history.redo()).toBe(true);
    expect(test.getCurrent().records.map((entry) => entry.keyId)).toEqual(['A', 'B', 'C', 'D', 'E', 'G1', 'G2', 'G3']);
    expect(test.getCurrent().loopClips[0].repeat).toBe(5);
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
  });
});
