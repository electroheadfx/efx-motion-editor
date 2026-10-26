import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { createEfxPaintDocument, type EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { createRotoScriptClipboardController, type RecordedStrokeGroup } from '../roto/physicsPaintRotoScriptClipboard';
import { buildPhysicPaintRotoPhysicalRevision, type PhysicPaintRotoPhysicalDocument } from '../roto/physicsPaintRotoPhysicalModel';
import { prepareRotoPhysicalLaunch } from '../roto/rotoLaunchHydration';
import { createPhysicsPaintLaunchReplacementCoordinator, resolveLaunchHydrationContext } from './usePhysicsPaintLaunchIntegration';

function launch(operationId: string, startFrame: number): PhysicPaintLaunchContext {
  return {
    operationId,
    layerId: `layer-${operationId}`,
    startFrame,
    width: 800,
    height: 520,
    fps: 24,
  };
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
      getSource: () => ({ selectionKind: 'real-key', layerId: 'old-layer', keyId: `key-${sourceFrame}`, appFrame: sourceFrame }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      getPublicationIdentity: () => ({
        operationId: 'old-operation',
        layerId: 'old-layer',
        cachedBase: null,
        background: { background: 'transparent', grainStrength: 0.5 },
      }),
      prepareTarget: async (current) => current.keyId ? { keyId: current.keyId, appFrame: current.appFrame } : null,
    });
    controller.updateEngine(engine);
    const copying = controller.copyScript();
    controller.observeCompletedMutation(engine, completion(1));
    await expect(copying).resolves.toBe(true);
    sourceFrame = 8;
    controller.updateSource({ selectionKind: 'real-key', layerId: 'old-layer', keyId: 'key-8', appFrame: 8 });
    const applying = controller.applyScript();
    // Let the asynchronous prepareTarget port settle so the Apply is registered
    // as the active operation before the replacement request drains it.
    await Promise.resolve();
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
      keyId: 'key-8',
      appFrame: 8,
      publishPixels: true,
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
      getSource: () => ({ selectionKind: 'real-key', layerId: 'layer-a', keyId: 'key-4', appFrame: 4 }),
      getMotion: () => ({ deformation: 0, position: 0 }),
      prepareTarget: async () => null,
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
      applyLatest: (context) => { events.push(`load:${context.operationId}`); },
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

// debug studio-idle-cursor-mismatch: the occlusion monitor reloads the hidden
// Studio every 3 minutes (`window_occlusion.rs`), so the child re-fetches the
// SAME stored launch envelope (same operationId, `startFrame` frozen at the
// original open frame) while `applySettledLaunchContext` substitutes the
// crash-recovery checkpoint document, whose active-track cursor is the LIVE
// cursor at the last document push. Substituting only the document leaves the
// envelope stale and the launch door refuses, aborting hydration before any
// launch context is committed — black canvas, "Engine not ready".
const DISABLED_INTERPOLATION = { enabled: false as const, mode: 'duplicate' as const };
const TRACK_ID = 'track-physical';

function physicalWithCursor(cursorAppFrame: number): PhysicPaintRotoPhysicalDocument {
  return {
    capacity: 600,
    realKeyRecords: [],
    groupOverrideRecords: [],
    interpolation: DISABLED_INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision([], DISABLED_INTERPOLATION, [], [], []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
  };
}

function documentWithCursor(
  layerId: string,
  cursorAppFrame: number,
  withPhysical = true,
): EfxPaintDocument {
  const base = createEfxPaintDocument(layerId);
  return {
    ...base,
    activeTrackId: TRACK_ID,
    tracks: [{
      ...base.tracks[0]!,
      id: TRACK_ID,
      name: 'Paint 1',
      rotoPhysical: withPhysical ? physicalWithCursor(cursorAppFrame) : null,
    }],
  } as EfxPaintDocument;
}

function launchWithCursor(operationId: string, startFrame: number): PhysicPaintLaunchContext {
  const layerId = `layer-${operationId}`;
  return {
    operationId,
    layerId,
    startFrame,
    document: documentWithCursor(layerId, startFrame),
  };
}

describe('debug studio-idle-cursor-mismatch: the checkpoint document owns the launch cursor', () => {
  it('reproduces the refusal when the checkpoint document is substituted without aligning startFrame', () => {
    const context = launchWithCursor('op-idle', 4);
    const checkpoint = documentWithCursor(context.layerId, 9);

    const prepared = prepareRotoPhysicalLaunch({ ...context, document: checkpoint });

    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error).toBe('Launch cursor does not match the canonical physical document.');
    }
  });

  it('aligns startFrame to the checkpoint active-track cursor so the same checkpoint hydrates', () => {
    const context = launchWithCursor('op-idle', 4);
    const checkpoint = documentWithCursor(context.layerId, 9);

    const hydrationContext = resolveLaunchHydrationContext(context, checkpoint);

    expect(hydrationContext).not.toBe(context);
    expect(hydrationContext.document).toBe(checkpoint);
    expect(hydrationContext.startFrame).toBe(9);
    // The door stays strict — the aligned envelope is coherent, not bypassed.
    expect(prepareRotoPhysicalLaunch(hydrationContext).ok).toBe(true);
    // The stored launch envelope is never mutated in place.
    expect(context.startFrame).toBe(4);
  });

  it('keeps the launch envelope untouched when no checkpoint exists', () => {
    const context = launchWithCursor('op-none', 4);

    expect(resolveLaunchHydrationContext(context, null)).toBe(context);
  });

  it('never invents a cursor when the checkpoint active track has no physical state (the door still refuses loudly)', () => {
    const context = launchWithCursor('op-empty', 4);
    const checkpoint = documentWithCursor(context.layerId, 9, false);

    const hydrationContext = resolveLaunchHydrationContext(context, checkpoint);

    expect(hydrationContext.startFrame).toBe(4);
    expect(prepareRotoPhysicalLaunch(hydrationContext).ok).toBe(false);
  });

  it('production substitution routes through the alignment helper', () => {
    const source = readFileSync(new URL('./usePhysicsPaintLaunchIntegration.ts', import.meta.url), 'utf8');

    expect(source).toContain('resolveLaunchHydrationContext(context, sessionDocument)');
    // The pre-fix ternary swapped the document without re-deriving the cursor.
    expect(source).not.toContain('sessionDocument ? { ...context, document: sessionDocument } : context');
  });
});
