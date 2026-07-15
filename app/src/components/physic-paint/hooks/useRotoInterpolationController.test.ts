import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { createRotoScriptClipboardController, type RecordedStrokeGroup } from '../roto/physicsPaintRotoScriptClipboard';
import { useRotoInterpolationController } from './useRotoInterpolationController';

vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
}));

function stroke(mutationId: number): PaintStroke {
  return {
    mutationId,
    tool: 'paint',
    points: [{ x: 10, y: 20, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0 }],
    color: '#123456',
    params: { size: 12, opacity: 100, pressure: 100, waterAmount: 50, dryAmount: 50, edgeDetail: 50, pickup: 50, eraseStrength: 50, antiAlias: 1 },
    timestamp: mutationId,
  };
}

function completion(mutationId: number): CompletedPaintMutation {
  return { kind: 'paint', isEmpty: false, mutationId };
}

function createHarness() {
  let strokes = [stroke(1)];
  let nextMutationId = 100;
  const launchContext: PhysicPaintLaunchContext = {
    operationId: 'launch-1',
    layerId: 'layer-1',
    startFrame: 8,
    cachedRotoFrames: [],
  };
  const engine = {
    getStrokes: () => strokes,
    enqueueRecordedStroke: vi.fn((_group: RecordedStrokeGroup) => nextMutationId++),
    setInputLocked: vi.fn(),
  };
  const script = createRotoScriptClipboardController({
    getEngine: () => engine,
    getSource: () => ({ workflowMode: 'roto', selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 }),
    getMotion: () => ({ deformation: 0, position: 0 }),
    prepareEmptyTarget: () => null,
    onFirstAcceptedBrush: vi.fn(),
    setNavigationLocked: vi.fn(),
  });
  script.updateEngine(engine);

  const updateSettings = vi.fn((_frame: number, patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    const settings: PhysicPaintRotoInterpolationSettings = {
      enabled: patch.enabled ?? true,
      inBetweenCount: patch.inBetweenCount ?? 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    };
    return { settings, nextCurrentFrame: 8, failureStatus: null, status: 'Updated interpolation.' };
  });
  const seedStore = {
    getRealRotoKeyFrames: vi.fn(() => []),
    upsertRealRotoKeyFrame: vi.fn(),
    setRotoInterpolationSettings: vi.fn(),
    getRotoInterpolationSettings: vi.fn(),
    getRotoCacheFrames: vi.fn(() => []),
  };
  const mutations = {
    updateSettings,
    getStoreFrames: vi.fn(() => []),
    seedStore,
    setEditableFrames: vi.fn(),
    replaceConfirmedFrames: vi.fn(),
    setLaunchContext: vi.fn(),
    sendFrameSync: vi.fn(async () => {}),
    sendApplyPayload: vi.fn(async () => {}),
    setApplyStatus: vi.fn(),
    setApplyMessage: vi.fn(),
    setLastError: vi.fn(),
    setPlaybackStatus: vi.fn(),
  };
  const interpolation = useRotoInterpolationController({
    launchContext,
    currentFrame: 8,
    bridgeMode: 'Browser fallback',
    ...mutations,
    isMutationLocked: () => script.mutationLocked.peek(),
  });

  return {
    engine,
    script,
    interpolation,
    mutations,
    setStrokes: (next: PaintStroke[]) => { strokes = next; },
  };
}

function expectNoInterpolationMutation(test: ReturnType<typeof createHarness>) {
  expect(test.mutations.updateSettings).not.toHaveBeenCalled();
  expect(test.mutations.seedStore.upsertRealRotoKeyFrame).not.toHaveBeenCalled();
  expect(test.mutations.getStoreFrames).not.toHaveBeenCalled();
  expect(test.mutations.setEditableFrames).not.toHaveBeenCalled();
  expect(test.mutations.replaceConfirmedFrames).not.toHaveBeenCalled();
  expect(test.mutations.setLaunchContext).not.toHaveBeenCalled();
  expect(test.mutations.sendApplyPayload).not.toHaveBeenCalled();
  expect(test.mutations.sendFrameSync).not.toHaveBeenCalled();
}

describe('useRotoInterpolationController mutation lock', () => {
  it.each([
    { name: 'Apply', cancel: false },
    { name: 'cancelled Apply drain', cancel: true },
  ])('blocks real interpolation callbacks through $name and restores them after accepted completion', async ({ cancel }) => {
    const test = createHarness();
    const copying = test.script.copyScript();
    test.script.observeCompletedMutation(test.engine, completion(1));
    await expect(copying).resolves.toBe(true);
    test.setStrokes([stroke(1)]);

    const applying = test.script.applyScript();
    if (cancel) test.script.cancelApply();
    expect(test.script.mutationLocked.value).toBe(true);

    await test.interpolation.updateRotoInterpolationSettings({ enabled: false });
    await test.interpolation.updateRotoInterpolationSettings({ inBetweenCount: 4 });
    expectNoInterpolationMutation(test);

    test.script.observeCompletedMutation(test.engine, completion(100));
    await expect(applying).resolves.toBe(!cancel);
    expect(test.script.mutationLocked.value).toBe(false);

    await test.interpolation.updateRotoInterpolationSettings({ enabled: false });
    await test.interpolation.updateRotoInterpolationSettings({ inBetweenCount: 4 });
    expect(test.mutations.updateSettings).toHaveBeenCalledTimes(2);
    expect(test.mutations.setLaunchContext).toHaveBeenCalledTimes(2);
    expect(test.mutations.sendApplyPayload).toHaveBeenCalledTimes(2);
  });
});
