import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import { createRotoScriptClipboardController, type RecordedStrokeGroup, type RotoScriptSourceSnapshot } from './physicsPaintRotoScriptClipboard';
import type { RotoSaveRealKeyTransaction } from './rotoKeyTransactions';

function stroke(mutationId: number, x = 10): PaintStroke {
  return {
    mutationId,
    tool: 'paint',
    points: [{ x, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }],
    color: '#123456',
    params: { size: 12, opacity: 100, pressure: 100, waterAmount: 50, dryAmount: 50, edgeDetail: 50, pickup: 50, eraseStrength: 50, antiAlias: 1 },
    timestamp: mutationId,
  };
}

function completion(mutationId: number): CompletedPaintMutation {
  return { kind: 'paint', isEmpty: false, mutationId };
}

function harness(initial: PaintStroke[] = [stroke(1)]) {
  let strokes = initial;
  let source: RotoScriptSourceSnapshot = { workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 4, displayFrame: 4 };
  let nextMutationId = 100;
  const submitted: RecordedStrokeGroup[] = [];
  const locks: boolean[] = [];
  const target = {
    target: { sourceFrame: 8, displayFrame: 8, previousSegmentOverride: null },
    model: { realSourceFrames: [4, 8], settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 } },
    sourceFrameOverride: 8,
    interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 },
  } satisfies RotoSaveRealKeyTransaction;
  const engine = {
    getStrokes: () => strokes.map((item) => ({ ...item, points: item.points.map((point) => ({ ...point })), params: { ...item.params } })),
    enqueueRecordedStroke: vi.fn((group: RecordedStrokeGroup) => {
      submitted.push(group);
      return nextMutationId++;
    }),
    setInputLocked: vi.fn((locked: boolean) => locks.push(locked)),
  };
  const onFirstAcceptedBrush = vi.fn();
  const controller = createRotoScriptClipboardController({
    getEngine: () => engine,
    getSource: () => source,
    getMotion: () => ({ deformation: 0, position: 0 }),
    prepareEmptyTarget: () => target,
    onFirstAcceptedBrush,
    setNavigationLocked: (locked) => locks.push(locked),
  });
  controller.updateEngine(engine);
  return {
    controller,
    engine,
    submitted,
    locks,
    target,
    onFirstAcceptedBrush,
    setStrokes: (next: PaintStroke[]) => { strokes = next; },
    setSource: (next: RotoScriptSourceSnapshot) => { source = next; controller.updateSource(next); },
  };
}

async function copyCompletedSource(test: ReturnType<typeof harness>, mutationIds = [1]) {
  const promise = test.controller.copyScript();
  for (const mutationId of mutationIds) test.controller.observeCompletedMutation(completion(mutationId));
  expect(await promise).toBe(true);
}

describe('Roto script clipboard controller', () => {
  it('drains accepted mutations, snapshots immutable logical brushes, and refreshes only while source-bound', async () => {
    const continuation = { ...stroke(1), points: [], diffusionFrames: 4 };
    const test = harness([stroke(1), continuation]);
    const copying = test.controller.copyScript();
    expect(test.controller.clipboard.value).toBeNull();
    expect(test.locks).toContain(true);
    test.controller.observeCompletedMutation(completion(1));
    expect(await copying).toBe(true);
    expect(test.controller.status.value).toBe('Copied 1');
    expect(test.controller.clipboard.value?.brushes[0].continuations).toHaveLength(1);
    expect(Object.isFrozen(test.controller.clipboard.value?.brushes[0].primary.points[0])).toBe(true);

    test.setStrokes([stroke(1, 77)]);
    test.controller.observeCompletedMutation(completion(1));
    expect(test.controller.clipboard.value?.brushes[0].primary.points[0].x).toBe(77);

    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 9, displayFrame: 9 });
    test.setStrokes([stroke(9, 99)]);
    test.controller.observeCompletedMutation(completion(9));
    expect(test.controller.clipboard.value?.sourceFrame).toBe(4);

    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 4, displayFrame: 4 });
    test.controller.notifySourceRevision();
    expect(test.controller.clipboard.value?.brushes[0].primary.points[0].x).toBe(99);
    test.setStrokes([]);
    test.controller.notifySourceRevision();
    expect(test.controller.clipboard.value).toBeNull();
  });

  it('reacts to first paint, Undo, Redo, Clear, engine replacement, and launch reset without a bound clipboard', () => {
    const test = harness([]);
    expect(test.controller.availability.value.canCopy).toBe(false);

    test.setStrokes([stroke(1)]);
    test.controller.observeCompletedMutation(completion(1));
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.setStrokes([]);
    test.controller.notifySourceRevision();
    expect(test.controller.availability.value.canCopy).toBe(false);

    test.setStrokes([stroke(2)]);
    test.controller.notifySourceRevision();
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.setStrokes([]);
    test.controller.observeCompletedMutation({ kind: 'clear', isEmpty: true, mutationId: 3 });
    expect(test.controller.availability.value.canCopy).toBe(false);

    const replacement = { ...test.engine, getStrokes: () => [stroke(4)] };
    test.controller.updateEngine(replacement);
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.controller.updateEngine(test.engine);
    test.setStrokes([]);
    test.controller.resetForLaunch();
    expect(test.controller.availability.value.canCopy).toBe(false);
    test.controller.updateEngine(null);
    expect(test.controller.availability.value.canCopy).toBe(false);
  });

  it('rejects invalid sources and destinations with stable native reasons', async () => {
    const test = harness([]);
    expect(test.controller.availability.value.copyDisabledReason).toMatch(/Paint at least one brush/);
    test.setSource({ workflowMode: 'roto', selectionKind: 'generated-interpolation', sourceFrame: 4, displayFrame: 5 });
    expect(test.controller.availability.value.copyDisabledReason).toMatch(/Generated frames/);
    expect(test.controller.availability.value.applyDisabledReason).toMatch(/Generated frames/);
    expect(await test.controller.copyScript()).toBe(false);
  });

  it('applies sequentially, ignores unrelated and duplicate completions, and remains reusable', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const firstApply = test.controller.applyScript();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    test.controller.observeCompletedMutation(completion(999));
    expect(test.controller.status.value).toBe('Applying 0/2');
    test.controller.observeCompletedMutation(completion(100));
    test.controller.observeCompletedMutation(completion(100));
    await Promise.resolve();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(2);
    expect(test.controller.status.value).toBe('Applying 1/2');
    test.controller.observeCompletedMutation(completion(101));
    await expect(firstApply).resolves.toBe(true);
    expect(test.controller.status.value).toBe('Applied 2');

    const secondApply = test.controller.applyScript();
    test.controller.observeCompletedMutation(completion(102));
    await Promise.resolve();
    test.controller.observeCompletedMutation(completion(103));
    await expect(secondApply).resolves.toBe(true);
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(4);
  });

  it('binds a prepared true-empty transaction only to accepted mutations and retains partial failure', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', sourceFrame: 8, displayFrame: 8 });
    test.engine.enqueueRecordedStroke.mockImplementationOnce((group) => {
      test.submitted.push(group);
      return 100;
    }).mockImplementationOnce(() => { throw new Error('later failure'); });
    const applying = test.controller.applyScript();
    expect(test.controller.getAcceptedTarget(100)).toEqual({
      sourceFrame: 8,
      displayFrame: 8,
      interpolationSettings: test.target.interpolationSettings,
    });
    expect(test.onFirstAcceptedBrush).toHaveBeenCalledTimes(1);
    test.controller.observeCompletedMutation(completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.status.value).toBe('Failed');
    expect(test.submitted).toHaveLength(1);
  });

  it('settles Copy and navigation drains and releases locks on reset or disposal', async () => {
    const copyTest = harness([stroke(1)]);
    const copying = copyTest.controller.copyScript();
    copyTest.controller.resetForLaunch();
    await expect(copying).resolves.toBe(false);
    expect(copyTest.controller.availability.value.busy).toBe(false);
    expect(copyTest.locks[copyTest.locks.length - 1]).toBe(false);

    const navigationTest = harness([stroke(1)]);
    await copyCompletedSource(navigationTest, [1]);
    const navigating = navigationTest.controller.prepareNavigation(9);
    navigationTest.controller.dispose();
    await expect(navigating).resolves.toBe(false);
    expect(navigationTest.locks[navigationTest.locks.length - 1]).toBe(false);
  });

  it('keeps cancelled Apply navigation-protected until accepted completion and ends Failed', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const applying = test.controller.applyScript();
    test.controller.cancelApply();

    expect(test.controller.availability.value.busy).toBe(true);
    await expect(test.controller.prepareNavigation(9)).resolves.toBe(false);
    expect(test.controller.status.value).toBe('Applying 0/2');

    test.controller.observeCompletedMutation(completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    expect(test.controller.availability.value.busy).toBe(false);
    expect(test.controller.status.value).toBe('Failed');
    await expect(test.controller.prepareNavigation(9)).resolves.toBe(true);
  });

  it('refreshes the bound source once after final Apply completion without partial snapshots', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    const originalRevision = test.controller.clipboard.value?.sourceRevision;
    const applying = test.controller.applyScript();

    test.setStrokes([stroke(1), stroke(2), stroke(100)]);
    test.controller.observeCompletedMutation(completion(100));
    await Promise.resolve();
    expect(test.controller.clipboard.value?.sourceRevision).toBe(originalRevision);

    test.setStrokes([stroke(1), stroke(2), stroke(100), stroke(101)]);
    test.controller.observeCompletedMutation(completion(101));
    await expect(applying).resolves.toBe(true);
    expect(test.controller.clipboard.value?.brushes).toHaveLength(4);
    expect(test.controller.clipboard.value?.sourceRevision).toBe((originalRevision ?? 0) + 1);
  });

  it('captures accepted destination identity across cancellation and source changes', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const applying = test.controller.applyScript();
    test.controller.cancelApply();
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 12, displayFrame: 12 });

    test.controller.observeCompletedMutation(completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.getAcceptedTarget(100)).toEqual({ sourceFrame: 8, displayFrame: 8, interpolationSettings: undefined });
  });
});
