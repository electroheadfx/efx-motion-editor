import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import { createRotoScriptClipboardController, type RecordedStrokeGroup, type RotoScriptSourceSnapshot } from './physicsPaintRotoScriptClipboard';
import type { RotoSaveRealKeyTransaction } from './rotoKeyTransactions';
import { createPhysicsPaintEngineActions } from '../engine/usePhysicsPaintEngineActions';
import { makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { createPhysicsPaintSessionController, type PhysicsPaintSessionControllerInput } from '../hooks/usePhysicsPaintSessionController';

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
  let motion = { deformation: 0, position: 0 };
  const flushSourcePublication = vi.fn(async () => {});
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
  let prepareEmptyTarget = () => target as RotoSaveRealKeyTransaction | null;
  const controller = createRotoScriptClipboardController({
    getEngine: () => engine,
    getSource: () => source,
    getMotion: () => motion,
    prepareEmptyTarget: () => prepareEmptyTarget(),
    flushSourcePublication,
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
    flushSourcePublication,
    setMotion: (next: { deformation: number; position: number }) => { motion = next; },
    setStrokes: (next: PaintStroke[]) => { strokes = next; },
    setSource: (next: RotoScriptSourceSnapshot) => { source = next; controller.updateSource(next); },
    setPrepareEmptyTarget: (next: () => RotoSaveRealKeyTransaction | null) => { prepareEmptyTarget = next; },
  };
}

async function copyCompletedSource(test: ReturnType<typeof harness>, mutationIds = [1]) {
  const promise = test.controller.copyScript();
  for (const mutationId of mutationIds) test.controller.observeCompletedMutation(test.engine, completion(mutationId));
  expect(await promise).toBe(true);
}

function settingsActions(test: ReturnType<typeof harness>) {
  let settings = makeInitialPhysicsPaintStudioSettings();
  const setSettings = vi.fn((update: PhysicsPaintStudioSettings | ((current: PhysicsPaintStudioSettings) => PhysicsPaintStudioSettings)) => {
    settings = typeof update === 'function' ? update(settings) : update;
  });
  const engine = Object.assign(test.engine, {
    setTool: vi.fn(), setPhysicsMode: vi.fn(), setColorHex: vi.fn(), setBrushOpacity: vi.fn(),
    setBrushSize: vi.fn(), setBgMode: vi.fn(), setPaperGrain: vi.fn(), setEmbossStrength: vi.fn(),
    setEdgeDetail: vi.fn(), setPickup: vi.fn(), setLocalSpreadStrength: vi.fn(), setAntiAlias: vi.fn(),
    setEraseStrength: vi.fn(), startPhysics: vi.fn(), stopPhysics: vi.fn(),
  });
  const actions = createPhysicsPaintEngineActions({
    engine: engine as never,
    settings,
    setSettings,
    isMutationLocked: () => test.controller.mutationLocked.peek(),
  });
  const invokeEveryAction = () => {
    actions.selectTool('erase', 'local'); actions.setBrushColor('#abcdef', 42); actions.setBrushSize(17);
    actions.setBrushOpacity(63); actions.setBackground('white'); actions.setPaperGrain('canvas2');
    actions.setGrainStrength(0.65); actions.setEdgeDetail(71); actions.setPickup(29); actions.setSpread(36);
    actions.setSmoothing(3); actions.setEraseStrength(88); actions.startPhysics('all'); actions.stopPhysics();
  };
  return { engine, setSettings, invokeEveryAction };
}

describe('Roto script clipboard controller', () => {
  it('drains accepted mutations and keeps an immutable clipboard until explicit replacement or discard', async () => {
    const continuation = { ...stroke(1), points: [], diffusionFrames: 4 };
    const test = harness([stroke(1), continuation]);
    const copying = test.controller.copyScript();
    expect(test.controller.clipboard.value).toBeNull();
    expect(test.locks).toContain(true);
    test.controller.observeCompletedMutation(test.engine, completion(1));
    expect(await copying).toBe(true);
    expect(test.controller.status.value).toBe('Copied 1');
    expect(test.controller.hasCopiedScript.value).toBe(true);
    expect(test.controller.copiedSourceFrame.value).toBe(4);
    expect(test.controller.copiedStrokeCount.value).toBe(1);
    expect(test.controller.clipboard.value?.brushes[0].continuations).toHaveLength(1);
    expect(Object.isFrozen(test.controller.clipboard.value?.brushes[0].primary.points[0])).toBe(true);

    const copied = test.controller.clipboard.value;
    test.setStrokes([stroke(1, 77)]);
    test.controller.observeCompletedMutation(test.engine, completion(1));
    expect(test.controller.clipboard.value).toBe(copied);
    expect(test.controller.clipboard.value?.brushes[0].primary.points[0].x).toBe(10);

    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 9, displayFrame: 9 });
    test.setStrokes([stroke(9, 99)]);
    test.controller.observeCompletedMutation(test.engine, completion(9));
    expect(test.controller.clipboard.value).toBe(copied);

    test.controller.discardScript();
    expect(test.controller.clipboard.value).toBeNull();
    expect(test.controller.hasCopiedScript.value).toBe(false);
    expect(test.controller.copiedSourceFrame.value).toBeNull();
    expect(test.controller.copiedStrokeCount.value).toBe(0);
  });

  it('preserves mounted clipboard provenance across launch echoes and foreign same-frame layers', async () => {
    const test = harness([stroke(1, 10)]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', layerId: 'layer-a', sourceFrame: 4, displayFrame: 4 });
    await copyCompletedSource(test);
    const copied = test.controller.clipboard.value;
    expect(copied?.provenance).toMatchObject({ layerId: 'layer-a', sourceFrame: 4 });

    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', layerId: 'layer-a', sourceFrame: 8, displayFrame: 8 });
    test.controller.completeLaunchReplacement();
    expect(test.controller.clipboard.value).toBe(copied);
    expect(test.controller.availability.value.canApply).toBe(true);

    test.setStrokes([]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', layerId: 'layer-b', sourceFrame: 4, displayFrame: 4 });
    test.controller.notifySourceRevision();
    expect(test.controller.clipboard.value).toBe(copied);

    test.setStrokes([stroke(2, 77)]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', layerId: 'layer-a', sourceFrame: 4, displayFrame: 4 });
    test.controller.notifySourceRevision();
    expect(test.controller.clipboard.value).toBe(copied);

    test.setStrokes([]);
    test.controller.notifySourceRevision();
    expect(test.controller.clipboard.value).toBe(copied);
  });

  it('captures persistence from the active real frame without replacing the reusable clipboard', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test);
    const copied = test.controller.clipboard.value;
    Object.assign(test.engine, { copyLiveAlphaCanvas: vi.fn(() => ({ id: 'alpha' } as unknown as HTMLCanvasElement)) });

    const capture = await test.controller.captureScriptForPersistence();

    expect(capture?.script.sourceFrame).toBe(4);
    expect(capture?.script.brushes).toHaveLength(1);
    expect(capture?.scriptAlphaCanvas).toEqual({ id: 'alpha' });
    expect(test.controller.clipboard.value).toBe(copied);
    expect(test.controller.availability.value.canApply).toBe(true);
  });

  it('loads a persisted deep clone without replay and keeps it independent and reusable', async () => {
    const test = harness([]);
    const persisted = {
      provenance: { sessionId: 'persisted', layerId: 'layer-a', sourceFrame: 3 }, sourceFrame: 3, sourceDisplayFrame: 9, sourceRevision: 1,
      brushes: [{ primary: stroke(7, 44), continuations: [] }],
    };

    expect(test.controller.replaceClipboardFromPersisted(persisted)).toBe(true);
    const loaded = test.controller.clipboard.value;
    persisted.brushes[0].primary.points[0].x = 999;
    expect(loaded?.brushes[0].primary.points[0].x).toBe(44);
    expect(Object.isFrozen(loaded?.brushes[0].primary.points[0])).toBe(true);
    expect(test.engine.enqueueRecordedStroke).not.toHaveBeenCalled();
    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', sourceFrame: 8, displayFrame: 8 });
    const applying = test.controller.applyScript();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledOnce();
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(true);
    expect(test.controller.clipboard.value).toBe(loaded);
  });

  it('reacts to first paint, Undo, Redo, Clear, engine replacement, and launch reset without a bound clipboard', () => {
    const test = harness([]);
    expect(test.controller.availability.value.canCopy).toBe(false);

    test.setStrokes([stroke(1)]);
    test.controller.observeCompletedMutation(test.engine, completion(1));
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.setStrokes([]);
    test.controller.notifySourceRevision();
    expect(test.controller.availability.value.canCopy).toBe(false);

    test.setStrokes([stroke(2)]);
    test.controller.notifySourceRevision();
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.setStrokes([]);
    test.controller.observeCompletedMutation(test.engine, { kind: 'clear', isEmpty: true, mutationId: 3 });
    expect(test.controller.availability.value.canCopy).toBe(false);

    const replacement = { ...test.engine, getStrokes: () => [stroke(4)] };
    test.controller.updateEngine(replacement);
    expect(test.controller.availability.value.canCopy).toBe(true);

    test.controller.updateEngine(test.engine);
    test.setStrokes([]);
    test.controller.completeLaunchReplacement();
    expect(test.controller.availability.value.canCopy).toBe(false);
    test.controller.updateEngine(null);
    expect(test.controller.availability.value.canCopy).toBe(false);
  });

  it('permits replacement Apply on real and empty Roto targets without a clipboard and rejects guarded destinations', async () => {
    const test = harness([]);
    expect(test.controller.clipboard.value).toBeNull();
    expect(test.controller.availability.value).toMatchObject({
      canApply: false,
      canApplyReplacement: true,
      applyDisabledReason: 'Copy a Roto paint script before applying it.',
      replacementApplyDisabledReason: null,
    });

    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', sourceFrame: 8, displayFrame: 8 });
    expect(test.controller.availability.value.canApplyReplacement).toBe(true);

    test.setSource({ workflowMode: 'play', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    expect(test.controller.availability.value.replacementApplyDisabledReason).toBe('Apply Script is available only in Roto mode.');

    test.setSource({ workflowMode: 'roto', selectionKind: 'generated-interpolation', sourceFrame: 8, displayFrame: 9 });
    expect(test.controller.availability.value.replacementApplyDisabledReason).toBe('Generated frames are render-only and cannot receive a script.');

    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    expect(await test.controller.prepareNavigation(9)).toBe(true);
    expect(test.controller.availability.value.replacementApplyDisabledReason).toBe('Finish the current script operation before applying another script.');
    test.controller.completeNavigation();
  });

  it('rejects invalid sources and destinations with stable native reasons', async () => {
    const test = harness([]);
    expect(test.controller.availability.value.copyDisabledReason).toMatch(/Paint at least one brush/);
    test.setSource({ workflowMode: 'roto', selectionKind: 'generated-interpolation', sourceFrame: 4, displayFrame: 5 });
    expect(test.controller.availability.value.copyDisabledReason).toMatch(/Generated frames/);
    expect(test.controller.availability.value.applyDisabledReason).toMatch(/Generated frames/);
    expect(await test.controller.copyScript()).toBe(false);
  });

  it('claims an empty selected frame only on first acceptance and keeps its exact identity', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test);
    const claim = {
      sourceFrame: 14,
      displayFrame: 14,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 },
    };
    test.setPrepareEmptyTarget(() => claim as never);
    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', layerId: 'layer-a', sourceFrame: 14, displayFrame: 14 });

    const applying = test.controller.applyScript();

    expect(test.onFirstAcceptedBrush).toHaveBeenCalledOnce();
    expect(test.controller.getAcceptedTarget(test.engine, 100)).toEqual({
      ...claim,
      publishPixels: true,
      publicationIdentity: undefined,
    });
    expect(test.controller.getAcceptedTarget(test.engine, 101)).toBeNull();
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(true);
  });

  it('leaves an empty selected frame unclaimed when the first replay brush is rejected', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test);
    test.setSource({ workflowMode: 'roto', selectionKind: 'empty', sourceFrame: 14, displayFrame: 14 });
    test.engine.enqueueRecordedStroke.mockImplementationOnce(() => { throw new Error('rejected'); });

    await expect(test.controller.applyScript()).resolves.toBe(false);
    expect(test.onFirstAcceptedBrush).not.toHaveBeenCalled();
    expect(test.controller.getAcceptedTarget(test.engine, 100)).toBeNull();
  });

  it('applies sequentially, ignores unrelated and duplicate completions, and remains reusable', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const firstApply = test.controller.applyScript();
    expect(test.controller.applying.value).toBe(true);
    expect(test.controller.applyProgress.value).toEqual({ completed: 0, total: 2 });
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    test.controller.observeCompletedMutation(test.engine, completion(999));
    expect(test.controller.status.value).toBe('Applying 0/2');
    expect(test.controller.applyProgress.value).toEqual({ completed: 0, total: 2 });
    test.controller.observeCompletedMutation(test.engine, completion(100));
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(2);
    expect(test.controller.status.value).toBe('Applying 1/2');
    expect(test.controller.applyProgress.value).toEqual({ completed: 1, total: 2 });
    test.controller.observeCompletedMutation(test.engine, completion(101));
    await expect(firstApply).resolves.toBe(true);
    expect(test.controller.status.value).toBe('Applied 2');
    expect(test.controller.applying.value).toBe(false);
    expect(test.controller.applyProgress.value).toBeNull();

    const secondApply = test.controller.applyScript();
    test.controller.observeCompletedMutation(test.engine, completion(102));
    await Promise.resolve();
    test.controller.observeCompletedMutation(test.engine, completion(103));
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
    expect(test.controller.getAcceptedTarget(test.engine, 100)).toEqual({
      sourceFrame: 8,
      displayFrame: 8,
      publishPixels: false,
      interpolationSettings: test.target.interpolationSettings,
      publicationIdentity: undefined,
    });
    expect(test.onFirstAcceptedBrush).toHaveBeenCalledTimes(1);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.status.value).toBe('Failed');
    expect(test.controller.error.value).toEqual({
      operation: 'apply',
      code: 'apply-partial-failure',
      message: 'Apply Script stopped after 1 of 2 brushes: later failure',
      cause: 'later failure',
    });
    expect(test.submitted).toHaveLength(1);
  });

  it('publishes detailed empty-target and enqueue failures through the stable error contract', async () => {
    const emptyTarget = harness([stroke(1)]);
    await copyCompletedSource(emptyTarget, [1]);
    emptyTarget.setSource({ workflowMode: 'roto', selectionKind: 'empty', sourceFrame: 8, displayFrame: 8 });
    emptyTarget.setPrepareEmptyTarget(() => null);

    await expect(emptyTarget.controller.applyScript()).resolves.toBe(false);
    expect(emptyTarget.controller.status.value).toBe('Failed');
    expect(emptyTarget.controller.error.value).toEqual({
      operation: 'apply',
      code: 'apply-empty-target-failed',
      message: 'Apply Script could not prepare the empty destination as a real Roto key.',
    });

    const enqueueFailure = harness([stroke(1)]);
    await copyCompletedSource(enqueueFailure, [1]);
    enqueueFailure.engine.enqueueRecordedStroke.mockImplementationOnce(() => { throw new Error('queue offline'); });

    await expect(enqueueFailure.controller.applyScript()).resolves.toBe(false);
    expect(enqueueFailure.controller.error.value).toEqual({
      operation: 'apply',
      code: 'apply-enqueue-failed',
      message: 'Apply Script could not enqueue its first brush: queue offline',
      cause: 'queue offline',
    });
  });

  it('reports cancellation and partial failure details, then clears prior errors on success', async () => {
    const cancelled = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(cancelled, [1, 2]);
    const cancelledApply = cancelled.controller.applyScript();
    cancelled.controller.cancelApply();
    expect(cancelled.controller.applying.value).toBe(true);
    expect(cancelled.controller.applyProgress.value).toEqual({ completed: 0, total: 2 });
    cancelled.controller.observeCompletedMutation(cancelled.engine, completion(100));
    expect(cancelled.controller.applyProgress.value).toEqual({ completed: 1, total: 2 });
    await expect(cancelledApply).resolves.toBe(false);
    expect(cancelled.controller.applying.value).toBe(false);
    expect(cancelled.controller.applyProgress.value).toBeNull();
    expect(cancelled.controller.error.value).toEqual({
      operation: 'apply',
      code: 'apply-cancelled',
      message: 'Apply Script was cancelled after 1 of 2 brushes completed.',
    });

    cancelled.engine.enqueueRecordedStroke.mockImplementationOnce(() => 101).mockImplementationOnce(() => 102);
    const successfulApply = cancelled.controller.applyScript();
    cancelled.controller.observeCompletedMutation(cancelled.engine, completion(101));
    await Promise.resolve();
    cancelled.controller.observeCompletedMutation(cancelled.engine, completion(102));
    await expect(successfulApply).resolves.toBe(true);
    expect(cancelled.controller.error.value).toBeNull();
  });

  it('suppresses stale launch and disposal failures from the current error contract', async () => {
    const staleLaunch = harness([stroke(1)]);
    const copying = staleLaunch.controller.copyScript();
    const replacing = staleLaunch.controller.prepareLaunchReplacement();
    staleLaunch.controller.observeCompletedMutation(staleLaunch.engine, completion(1));
    await replacing;
    staleLaunch.controller.completeLaunchReplacement();
    await expect(copying).resolves.toBe(false);
    expect(staleLaunch.controller.error.value).toBeNull();

    const disposed = harness([stroke(1)]);
    const disposedCopy = disposed.controller.copyScript();
    const disposal = disposed.controller.dispose();
    disposed.controller.observeCompletedMutation(disposed.engine, completion(1));
    await expect(disposedCopy).resolves.toBe(false);
    await disposal;
    expect(disposed.controller.error.value).toBeNull();
  });

  it('blocks real engine settings actions throughout Copy drain and resumes after accepted completion', async () => {
    const test = harness([stroke(1)]);
    const settings = settingsActions(test);
    const copying = test.controller.copyScript();

    expect(test.controller.mutationLocked.value).toBe(true);
    settings.invokeEveryAction();
    expect(settings.setSettings).not.toHaveBeenCalled();
    for (const method of [settings.engine.setTool, settings.engine.setPhysicsMode, settings.engine.setColorHex, settings.engine.setBrushOpacity,
      settings.engine.setBrushSize, settings.engine.setBgMode, settings.engine.setPaperGrain, settings.engine.setEmbossStrength,
      settings.engine.setEdgeDetail, settings.engine.setPickup, settings.engine.setLocalSpreadStrength, settings.engine.setAntiAlias,
      settings.engine.setEraseStrength, settings.engine.startPhysics, settings.engine.stopPhysics]) expect(method).not.toHaveBeenCalled();

    test.controller.observeCompletedMutation(test.engine, completion(1));
    await expect(copying).resolves.toBe(true);
    expect(test.controller.mutationLocked.value).toBe(false);
    settings.invokeEveryAction();
    expect(settings.engine.setTool).toHaveBeenCalledWith('erase');
    expect(settings.setSettings).toHaveBeenCalled();
  });

  it('blocks real engine settings actions until navigation transition protection releases', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test, [1]);
    test.setStrokes([stroke(2)]);
    const settings = settingsActions(test);
    const navigating = test.controller.prepareNavigation(9);

    expect(test.controller.mutationLocked.value).toBe(true);
    settings.invokeEveryAction();
    expect(settings.setSettings).not.toHaveBeenCalled();
    test.controller.observeCompletedMutation(test.engine, completion(2));
    await expect(navigating).resolves.toBe(true);
    expect(test.controller.mutationLocked.value).toBe(true);
    settings.invokeEveryAction();
    expect(settings.setSettings).not.toHaveBeenCalled();

    test.controller.completeNavigation();
    expect(test.controller.mutationLocked.value).toBe(false);
    settings.invokeEveryAction();
    expect(settings.engine.setTool).toHaveBeenCalledWith('erase');
  });

  it('keeps Copy and navigation locks owned until replacement or disposal handoff completes', async () => {
    const copyTest = harness([stroke(1)]);
    const copying = copyTest.controller.copyScript();
    const replacing = copyTest.controller.prepareLaunchReplacement();
    expect(copyTest.controller.availability.value.busy).toBe(true);
    copyTest.controller.observeCompletedMutation(copyTest.engine, completion(1));
    await expect(replacing).resolves.toBeUndefined();
    copyTest.controller.completeLaunchReplacement();
    await expect(copying).resolves.toBe(false);
    expect(copyTest.controller.availability.value.busy).toBe(false);

    const navigationTest = harness([stroke(1)]);
    await copyCompletedSource(navigationTest, [1]);
    navigationTest.setStrokes([stroke(2)]);
    const navigating = navigationTest.controller.prepareNavigation(9);
    const disposing = navigationTest.controller.dispose();
    expect(navigationTest.controller.availability.value.busy).toBe(true);
    navigationTest.controller.observeCompletedMutation(navigationTest.engine, completion(2));
    await expect(navigating).resolves.toBe(true);
    navigationTest.controller.completeNavigation();
    await expect(disposing).resolves.toBeUndefined();
    expect(navigationTest.locks[navigationTest.locks.length - 1]).toBe(false);
  });

  it('blocks session Save and Load through Apply cancellation drain and resumes after accepted completion', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test, [1]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const save = vi.fn(() => ({ version: 1, strokes: [] }));
    const load = vi.fn();
    const downloadState = vi.fn(async () => ({ status: 'saved' as const, message: 'Saved editable JSON state.' }));
    const reader = { readAsText: vi.fn(), onload: null, onerror: null, result: '' } as unknown as FileReader;
    const session = createPhysicsPaintSessionController({
      engine: { save, load }, workflowMode: 'roto', framesToApply: 1, canvasSize: { width: 800, height: 520 },
      launchContext: null, currentFrame: 8, previewFps: 24, capturePendingPlayFrameEdits: vi.fn(),
      annotatePlayState: vi.fn((state) => state), restorePlayFrameEdits: vi.fn(), clearLatestPlayFrames: vi.fn(),
      setCachedPlayPreviewUrl: vi.fn(), setSavedPlayCacheDirty: vi.fn(), setLocalPlayPreviewFrame: vi.fn(),
      setFramesToApply: vi.fn(), bumpPlayFramesVersion: vi.fn(), setLaunchContext: vi.fn(), setApplyStatus: vi.fn(),
      setApplyMessage: vi.fn(), setLastError: vi.fn(), isMutationLocked: () => test.controller.mutationLocked.peek(),
    } as unknown as PhysicsPaintSessionControllerInput, { downloadState, createFileReader: () => reader });
    const target = { files: [{ name: 'state.json' }], value: 'state.json' } as unknown as HTMLInputElement;
    const applying = test.controller.applyScript();
    test.controller.cancelApply();

    await session.saveEditableState();
    session.loadEditableState({ target } as unknown as Event);
    expect(save).not.toHaveBeenCalled();
    expect(downloadState).not.toHaveBeenCalled();
    expect(reader.readAsText).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();

    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    await session.saveEditableState();
    session.loadEditableState({ target } as unknown as Event);
    expect(save).toHaveBeenCalledTimes(1);
    expect(downloadState).toHaveBeenCalledTimes(1);
    expect(reader.readAsText).toHaveBeenCalledTimes(1);
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

    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    expect(test.controller.availability.value.busy).toBe(false);
    expect(test.controller.status.value).toBe('Failed');
    await expect(test.controller.prepareNavigation(9)).resolves.toBe(true);
  });

  it('keeps the copied snapshot unchanged through Apply and publishes only the final composite', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    const copied = test.controller.clipboard.value;
    test.flushSourcePublication.mockClear();
    const applying = test.controller.applyScript();

    expect(test.controller.getAcceptedTarget(test.engine, 100)?.publishPixels).toBe(false);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    expect(test.controller.clipboard.value).toBe(copied);
    expect(test.flushSourcePublication).not.toHaveBeenCalled();

    expect(test.controller.getAcceptedTarget(test.engine, 101)?.publishPixels).toBe(true);
    test.controller.observeCompletedMutation(test.engine, completion(101));
    await expect(applying).resolves.toBe(true);
    expect(test.controller.clipboard.value).toBe(copied);
    expect(test.flushSourcePublication).toHaveBeenCalledOnce();
    expect(test.flushSourcePublication).toHaveBeenCalledWith(4);
  });

  it('captures accepted destination identity across cancellation and source changes', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const applying = test.controller.applyScript();
    test.controller.cancelApply();
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 12, displayFrame: 12 });

    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.getAcceptedTarget(test.engine, 100)).toEqual({
      sourceFrame: 8,
      displayFrame: 8,
      publishPixels: false,
      interpolationSettings: undefined,
      publicationIdentity: undefined,
    });
  });

  it('settles a Copy drain on its accepting engine after non-null replacement', async () => {
    const test = harness([stroke(1)]);
    const replacement = { ...test.engine, getStrokes: () => [stroke(9)] };
    const copying = test.controller.copyScript();

    test.controller.updateEngine(replacement);
    expect(test.controller.availability.value.busy).toBe(true);
    test.controller.observeCompletedMutation(test.engine, completion(1));

    await expect(copying).resolves.toBe(false);
    expect(test.controller.availability.value.busy).toBe(false);
  });

  it('never enqueues remaining Apply brushes on a replacement engine', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const replacement = { ...test.engine, enqueueRecordedStroke: vi.fn(() => 900) };
    const applying = test.controller.applyScript();

    test.controller.updateEngine(replacement);
    expect(test.controller.applyProgress.value).toEqual({ completed: 0, total: 2 });
    test.controller.observeCompletedMutation(replacement, completion(100));
    expect(test.controller.applyProgress.value).toEqual({ completed: 0, total: 2 });
    test.controller.observeCompletedMutation(test.engine, completion(100));

    await expect(applying).resolves.toBe(false);
    expect(test.controller.applyProgress.value).toBeNull();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    expect(replacement.enqueueRecordedStroke).not.toHaveBeenCalled();
  });

  it('finishes accepted Apply work before same-size launch replacement and preserves publication', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const copied = test.controller.clipboard.value;
    const applying = test.controller.applyScript();
    const acceptedFirst = test.controller.getAcceptedTarget(test.engine, 100);

    expect(test.controller.mutationLocked.value).toBe(true);
    const replacing = test.controller.prepareLaunchReplacement();
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    const acceptedFinal = test.controller.getAcceptedTarget(test.engine, 101);
    test.controller.observeCompletedMutation(test.engine, completion(101));

    await expect(applying).resolves.toBe(true);
    await expect(replacing).resolves.toBeUndefined();
    test.controller.completeLaunchReplacement();

    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(2);
    expect(test.controller.clipboard.value).toBe(copied);
    expect(acceptedFirst?.publishPixels).toBe(false);
    expect(acceptedFinal?.publishPixels).toBe(true);
    expect(test.flushSourcePublication).toHaveBeenCalledWith(8);
    expect(test.controller.mutationLocked.value).toBe(false);
  });

  it('samples current Motion values at Apply time and preserves the reusable snapshot', async () => {
    const test = harness([stroke(1)]);
    await copyCompletedSource(test);
    const copied = test.controller.clipboard.value;
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    test.setMotion({ deformation: 100, position: 100 });
    const applying = test.controller.applyScript();

    expect(test.submitted).toHaveLength(1);
    expect(test.submitted[0].primary.points).not.toEqual(copied?.brushes[0].primary.points);
    expect(test.submitted[0].primary).toMatchObject({
      tool: copied?.brushes[0].primary.tool,
      color: copied?.brushes[0].primary.color,
      params: copied?.brushes[0].primary.params,
    });
    expect(test.submitted[0].primary.physicsMode).toBe(copied?.brushes[0].primary.physicsMode);
    test.controller.observeCompletedMutation(test.engine, completion(100));

    await expect(applying).resolves.toBe(true);
    expect(test.controller.status.value).toBe('Applied 1');
    expect(test.controller.clipboard.value).toBe(copied);
  });
});
