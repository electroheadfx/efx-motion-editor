import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { createRotoScriptClipboardController, type RecordedStrokeGroup } from '../roto/physicsPaintRotoScriptClipboard';
import { createPhysicsPaintLaunchReplacementCoordinator } from './usePhysicsPaintLaunchIntegration';

function launch(operationId: string, startFrame: number): PhysicPaintLaunchContext {
  return {
    operationId,
    layerId: `layer-${operationId}`,
    startFrame,
    width: 800,
    height: 520,
    fps: 24,
    workflowMode: 'roto',
    cachedRotoFrames: [],
  } as PhysicPaintLaunchContext;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => { resolve = settle; });
  return { promise, resolve };
}

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

describe('Physics Paint launch replacement coordinator', () => {
  it('drains a real accepted Apply before clear/load and retains captured old-destination publication', async () => {
    let strokes = [stroke(1)];
    let nextMutationId = 100;
    let sourceFrame = 4;
    const engine = {
      getStrokes: () => strokes,
      enqueueRecordedStroke: vi.fn((_group: Readonly<RecordedStrokeGroup>) => nextMutationId++),
      setInputLocked: vi.fn(),
    };
    const controller = createRotoScriptClipboardController({
      getEngine: () => engine,
      getSource: () => ({ selectionKind: 'real-key', sourceFrame, displayFrame: sourceFrame }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getPublicationIdentity: () => ({
        operationId: 'old-operation',
        layerId: 'old-layer',
        cachedBase: null,
        background: { background: 'transparent', paperGrain: 'watercolor', grainStrength: 0.5 },
      }),
      prepareEmptyTarget: () => null,
    });
    controller.updateEngine(engine);
    const copying = controller.copyScript();
    controller.observeCompletedMutation(engine, completion(1));
    await expect(copying).resolves.toBe(true);
    sourceFrame = 8;
    controller.updateSource({ selectionKind: 'real-key', sourceFrame: 8, displayFrame: 8 });
    const applying = controller.applyScript();
    const events: string[] = [];
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: () => controller.prepareLaunchReplacement(),
      applyLatest: () => {
        events.push('clear/load');
        controller.completeLaunchReplacement();
      },
    });

    coordinator.request(launch('replacement', 12));
    await Promise.resolve();
    expect(events).toEqual([]);
    expect(controller.mutationLocked.value).toBe(true);

    const capturedTarget = controller.getAcceptedTarget(engine, 100);
    strokes = [...strokes, stroke(100)];
    controller.observeCompletedMutation(engine, completion(100));
    await expect(applying).resolves.toBe(true);
    await Promise.resolve();

    expect(capturedTarget).toMatchObject({
      sourceFrame: 8,
      displayFrame: 8,
      publicationIdentity: { operationId: 'old-operation', layerId: 'old-layer' },
    });
    expect(events).toEqual(['clear/load']);
    expect(controller.mutationLocked.value).toBe(false);
    expect(controller.availability.value.busy).toBe(false);
  });

  it('keeps an established mounted clipboard through coalesced navigation and delayed launch contexts', async () => {
    const engine = {
      getStrokes: () => [stroke(1)],
      enqueueRecordedStroke: vi.fn(() => 100),
      setInputLocked: vi.fn(),
    };
    const controller = createRotoScriptClipboardController({
      sessionId: 'mounted-session',
      getEngine: () => engine,
      getSource: () => ({ selectionKind: 'real-key', layerId: 'layer-a', sourceFrame: 4, displayFrame: 4 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      prepareEmptyTarget: () => null,
    });
    controller.updateEngine(engine);
    const copying = controller.copyScript();
    controller.observeCompletedMutation(engine, completion(1));
    await expect(copying).resolves.toBe(true);
    const copied = controller.clipboard.value;
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: controller.prepareLaunchReplacement,
      applyLatest: () => controller.completeLaunchReplacement(),
    });

    coordinator.request({ ...launch('navigation', 8), layerId: 'layer-a' });
    coordinator.request({ ...launch('delayed', 4), layerId: 'layer-b' });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.clipboard.value).toBe(copied);
    expect(controller.clipboard.value?.provenance).toEqual({ sessionId: 'mounted-session', layerId: 'layer-a', sourceFrame: 4 });
  });

  it('waits for the cooperative handoff before applying a replacement launch', async () => {
    const drain = deferred();
    const events: string[] = [];
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: async () => {
        events.push('prepare');
        await drain.promise;
        events.push('drained');
      },
      applyLatest: (context) => events.push(`load:${context.operationId}`),
    });

    coordinator.request(launch('replacement', 8));
    await Promise.resolve();
    expect(events).toEqual(['prepare']);

    drain.resolve();
    await drain.promise;
    await Promise.resolve();
    expect(events).toEqual(['prepare', 'drained', 'load:replacement']);
  });

  it('applies immediately when the controller has no accepted work', async () => {
    const applyLatest = vi.fn();
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: () => Promise.resolve(),
      applyLatest,
    });

    const context = launch('immediate', 3);
    coordinator.request(context);
    await Promise.resolve();
    await Promise.resolve();

    expect(applyLatest).toHaveBeenCalledOnce();
    expect(applyLatest).toHaveBeenCalledWith(context);
  });

  it('coalesces rapid replacements so only the latest context loads after the drain', async () => {
    const drain = deferred();
    const applyLatest = vi.fn();
    const prepareReplacement = vi.fn(() => drain.promise);
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({ prepareReplacement, applyLatest });

    coordinator.request(launch('first', 1));
    coordinator.request(launch('second', 2));
    coordinator.request(launch('latest', 3));
    await Promise.resolve();
    expect(prepareReplacement).toHaveBeenCalledOnce();
    expect(applyLatest).not.toHaveBeenCalled();

    drain.resolve();
    await drain.promise;
    await Promise.resolve();

    expect(applyLatest).toHaveBeenCalledOnce();
    expect(applyLatest.mock.calls[0][0].operationId).toBe('latest');
  });

  it('does not load a queued launch after component disposal', async () => {
    const drain = deferred();
    const applyLatest = vi.fn();
    const coordinator = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: () => drain.promise,
      applyLatest,
    });

    coordinator.request(launch('disposed', 4));
    coordinator.dispose();
    drain.resolve();
    await drain.promise;
    await Promise.resolve();

    expect(applyLatest).not.toHaveBeenCalled();
  });
});
