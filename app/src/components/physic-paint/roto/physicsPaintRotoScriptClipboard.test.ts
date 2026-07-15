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
  it('drains accepted mutations, snapshots immutable logical brushes, and refreshes only while source-bound', async () => {
    const continuation = { ...stroke(1), points: [], diffusionFrames: 4 };
    const test = harness([stroke(1), continuation]);
    const copying = test.controller.copyScript();
    expect(test.controller.clipboard.value).toBeNull();
    expect(test.locks).toContain(true);
    test.controller.observeCompletedMutation(test.engine, completion(1));
    expect(await copying).toBe(true);
    expect(test.controller.status.value).toBe('Copied 1');
    expect(test.controller.clipboard.value?.brushes[0].continuations).toHaveLength(1);
    expect(Object.isFrozen(test.controller.clipboard.value?.brushes[0].primary.points[0])).toBe(true);

    test.setStrokes([stroke(1, 77)]);
    test.controller.observeCompletedMutation(test.engine, completion(1));
    expect(test.controller.clipboard.value?.brushes[0].primary.points[0].x).toBe(77);

    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 9, displayFrame: 9 });
    test.setStrokes([stroke(9, 99)]);
    test.controller.observeCompletedMutation(test.engine, completion(9));
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
    test.controller.observeCompletedMutation(test.engine, completion(999));
    expect(test.controller.status.value).toBe('Applying 0/2');
    test.controller.observeCompletedMutation(test.engine, completion(100));
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(2);
    expect(test.controller.status.value).toBe('Applying 1/2');
    test.controller.observeCompletedMutation(test.engine, completion(101));
    await expect(firstApply).resolves.toBe(true);
    expect(test.controller.status.value).toBe('Applied 2');

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
      interpolationSettings: test.target.interpolationSettings,
    });
    expect(test.onFirstAcceptedBrush).toHaveBeenCalledTimes(1);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.status.value).toBe('Failed');
    expect(test.submitted).toHaveLength(1);
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

  it('keeps Copy and navigation drains locked until the accepting engine completes across reset or disposal', async () => {
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
    await expect(navigating).resolves.toBe(false);
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

  it('refreshes the bound source once after final Apply completion without partial snapshots', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    const originalRevision = test.controller.clipboard.value?.sourceRevision;
    const applying = test.controller.applyScript();

    test.setStrokes([stroke(1), stroke(2), stroke(100)]);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    expect(test.controller.clipboard.value?.sourceRevision).toBe(originalRevision);

    test.setStrokes([stroke(1), stroke(2), stroke(100), stroke(101)]);
    test.controller.observeCompletedMutation(test.engine, completion(101));
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

    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(false);
    expect(test.controller.getAcceptedTarget(test.engine, 100)).toEqual({ sourceFrame: 8, displayFrame: 8, interpolationSettings: undefined });
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
    test.controller.observeCompletedMutation(test.engine, completion(100));

    await expect(applying).resolves.toBe(false);
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    expect(replacement.enqueueRecordedStroke).not.toHaveBeenCalled();
  });

  it('drains accepted Apply work before same-size reused-engine launch replacement and preserves captured publication', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    test.setSource({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const applying = test.controller.applyScript();
    const acceptedBeforeDrain = test.controller.getAcceptedTarget(test.engine, 100);

    expect(test.controller.mutationLocked.value).toBe(true);
    const replacing = test.controller.prepareLaunchReplacement();
    expect(test.controller.mutationLocked.value).toBe(true);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await expect(replacing).resolves.toBeUndefined();
    test.controller.completeLaunchReplacement();
    await Promise.resolve();

    await expect(applying).resolves.toBe(false);
    expect(test.engine.enqueueRecordedStroke).toHaveBeenCalledTimes(1);
    expect(test.controller.status.value).toBeNull();
    expect(acceptedBeforeDrain?.sourceFrame).toBe(8);
    expect(acceptedBeforeDrain?.displayFrame).toBe(8);
    expect(test.controller.getAcceptedTarget(test.engine, 101)).toBeNull();
    expect(test.controller.mutationLocked.value).toBe(false);
  });

  it('keeps Applied terminal status while refreshing a bound-source clipboard', async () => {
    const test = harness([stroke(1), stroke(2)]);
    await copyCompletedSource(test, [1, 2]);
    const applying = test.controller.applyScript();
    test.setStrokes([stroke(1), stroke(2), stroke(100)]);
    test.controller.observeCompletedMutation(test.engine, completion(100));
    await Promise.resolve();
    test.setStrokes([stroke(1), stroke(2), stroke(100), stroke(101)]);
    test.controller.observeCompletedMutation(test.engine, completion(101));

    await expect(applying).resolves.toBe(true);
    expect(test.controller.status.value).toBe('Applied 2');
    expect(test.controller.clipboard.value?.brushes).toHaveLength(4);
  });
});
