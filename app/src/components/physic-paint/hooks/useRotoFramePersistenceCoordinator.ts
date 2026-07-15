import { useCallback, useRef } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { buildBlankRotoFrame, encodeRotoFrameFromCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { mergeCachedRotoAlphaFrame } from '../roto/physicsPaintRotoAlphaMerge';
import { createRotoLivePixelCacheTransactions } from '../roto/rotoLivePixelCacheTransactions';
import { removeCachedRotoCacheFrame, upsertCachedRotoCacheFrame } from '../roto/rotoCacheTransactions';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { useRotoReferenceController } from './useRotoReferenceController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

function hasSameRotoCacheTopology(
  currentFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  nextFrames: readonly PhysicPaintRotoCacheFrame[],
): boolean {
  if ((currentFrames?.length ?? 0) !== nextFrames.length) return false;
  return nextFrames.every((next, index) => {
    const current = currentFrames?.[index];
    return current !== undefined
      && current.appFrame === next.appFrame
      && current.frameIndex === next.frameIndex
      && current.source === next.source
      && current.sourceFrame === next.sourceFrame
      && current.displayFrame === next.displayFrame
      && current.nearestRealKeyFrame === next.nearestRealKeyFrame
      && current.fromSourceFrame === next.fromSourceFrame
      && current.toSourceFrame === next.toSourceFrame
      && current.interpolationT === next.interpolationT
      && current.backgroundOnly === next.backgroundOnly;
  });
}

function hasSameRotoInterpolationSettings(
  current: PhysicPaintRotoInterpolationSettings | undefined,
  next: PhysicPaintRotoInterpolationSettings,
): boolean {
  if (!current
    || current.enabled !== next.enabled
    || current.inBetweenCount !== next.inBetweenCount
    || current.mode !== next.mode
    || current.deform !== next.deform
    || current.position !== next.position) return false;
  const currentOverrides = current.segmentSpacingOverrides ?? [];
  const nextOverrides = next.segmentSpacingOverrides ?? [];
  return currentOverrides.length === nextOverrides.length
    && nextOverrides.every((override, index) => {
      const currentOverride = currentOverrides[index];
      return currentOverride !== undefined
        && currentOverride.fromSourceFrame === override.fromSourceFrame
        && currentOverride.toSourceFrame === override.toSourceFrame
        && currentOverride.inBetweenCount === override.inBetweenCount;
    });
}

interface RotoPersistenceStorePort {
  getRotoFrame: (layerId: string, frame: number) => RenderedFramePayload | null;
  getFrame: (layerId: string, frame: number) => RenderedFramePayload | null;
  upsertRealKey: (layerId: string, frame: number, renderedFrame: PhysicPaintRotoCacheFrame, backgroundOnly: boolean, diagnostics?: { mutationId?: number; record: typeof recordPhysicsPaintPerformance }) => void;
  removeRealKey: (layerId: string, frame: number) => boolean;
  getCacheFrames: (layerId: string) => PhysicPaintRotoCacheFrame[];
  getInterpolationSettings: (layerId: string) => PhysicPaintRotoInterpolationSettings;
  setInterpolationSettings: (layerId: string, settings: PhysicPaintRotoInterpolationSettings) => void;
}

export interface UseRotoFramePersistenceCoordinatorInput {
  workflowMode: PhysicsPaintWorkflowMode;
  backgroundMode: BgMode;
  launchContext: PhysicPaintLaunchContext | null;
  latestFramesRef: { current: PhysicPaintRotoCacheFrame[] };
  setLaunchContext: (update: (current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null) => void;
  store: RotoPersistenceStorePort;
  syncPending: () => void;
  getBackgroundMetadata: () => PhysicPaintRotoBackgroundMetadata;
  sendCachePayload: (payload: PhysicPaintApplyPayload) => Promise<void>;
  setApplyMessage: (message: string) => void;
}

export function useRotoFramePersistenceCoordinator(input: UseRotoFramePersistenceCoordinatorInput) {
  const editBuffer = useRotoEditBufferController<ReturnType<import('@efxlab/efx-physic-paint').EfxPaintEngine['save']>, RenderedFramePayload>();
  const confirmedFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const livePixelTransactionsRef = useRef(createRotoLivePixelCacheTransactions());
  const buffer = editBuffer.bufferRef.current;
  const parentDeliveryRef = useRef<Map<number, Promise<void>>>(new Map());
  const parentOperationRevisionRef = useRef(0);
  const {
    latestFramesRef,
    setLaunchContext,
    store,
  } = input;
  const inputRef = useRef(input);
  inputRef.current = input;
  const queueParentPayload = useCallback((sourceFrame: number, payload: PhysicPaintApplyPayload, mutationId?: number) => {
    const previous = parentDeliveryRef.current.get(sourceFrame) ?? Promise.resolve();
    const profiling = isPhysicsPaintProfilingEnabled();
    const queuedAt = profiling ? performance.now() : 0;
    const delivery = previous
      .catch(() => undefined)
      .then(async () => {
        const deliveryStartedAt = profiling ? performance.now() : 0;
        if (profiling) recordPhysicsPaintPerformance({ stage: 'bridge-queue-wait', category: 'scheduled-wait', durationMs: deliveryStartedAt - queuedAt, timestamp: deliveryStartedAt, mutationId, sourceFrame });
        await inputRef.current.sendCachePayload(payload);
        if (profiling) recordPhysicsPaintPerformance({ stage: 'bridge-delivery', category: 'async-elapsed', durationMs: performance.now() - deliveryStartedAt, timestamp: performance.now(), mutationId, sourceFrame });
      })
      .catch((error) => { console.error('[PhysicsPaintStudio] Roto cache delivery failed', error); });
    parentDeliveryRef.current.set(sourceFrame, delivery);
    void delivery.then(() => {
      if (parentDeliveryRef.current.get(sourceFrame) === delivery) parentDeliveryRef.current.delete(sourceFrame);
    });
  }, []);
  const reference = useRotoReferenceController<RenderedFramePayload>({
    workflowMode: input.workflowMode,
    settingsBackground: input.backgroundMode,
    getCachedRotoFrames: () => latestFramesRef.current,
    previewFrames: buffer.previewFrames,
    confirmedFrames: confirmedFramesRef.current,
    dirtyFrames: buffer.dirtyFrames,
    liveOverlayActionCounts: buffer.liveOverlayActionCounts,
    getRotoFrame: (frame) => input.launchContext ? store.getRotoFrame(input.launchContext.layerId, frame) : null,
    getFrame: (frame) => input.launchContext ? store.getFrame(input.launchContext.layerId, frame) : null,
    syncPending: () => inputRef.current.syncPending(),
    setApplyMessage: (message) => inputRef.current.setApplyMessage(message),
  });

  const upsertCachedFrame = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null, interpolationSettings?: PhysicPaintRotoInterpolationSettings, expectedLayerId?: string, mutationId?: number, expectedOperationId?: string, background?: PhysicPaintRotoBackgroundMetadata) => {
    const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame;
    const normalized = { ...renderedFrame, appFrame: sourceFrame };
    setLaunchContext((current) => {
      if (!current || (expectedLayerId !== undefined && (current.layerId !== expectedLayerId || (expectedOperationId !== undefined && current.operationId !== expectedOperationId)))) {
        if (expectedLayerId !== undefined && expectedOperationId !== undefined) {
          const frameForCache = { ...normalized, source: 'real-key' as const, sourceFrame, displayFrame: renderedFrame.displayFrame ?? sourceFrame };
          store.upsertRealKey(expectedLayerId, sourceFrame, frameForCache, backgroundOnly, isPhysicsPaintProfilingEnabled() ? { mutationId, record: recordPhysicsPaintPerformance } : undefined);
          if (interpolationSettings) store.setInterpolationSettings(expectedLayerId, interpolationSettings);
          queueParentPayload(sourceFrame, {
            operationId: `${expectedOperationId}:live-pixels:${sourceFrame}:${++parentOperationRevisionRef.current}`,
            kind: 'apply-canvas',
            layerId: expectedLayerId,
            startFrame: sourceFrame,
            sourceFrame,
            displayFrame: frameForCache.displayFrame,
            renderedFrame: frameForCache,
            backgroundOnly,
            rotoBackground: background ?? inputRef.current.getBackgroundMetadata(),
            rotoInterpolationSettings: interpolationSettings ?? store.getInterpolationSettings(expectedLayerId),
          }, mutationId);
        }
        return current;
      }
      confirmedFramesRef.current.set(sourceFrame, normalized);
      const frameForCache = { ...normalized, source: 'real-key' as const, sourceFrame, displayFrame: renderedFrame.displayFrame ?? sourceFrame };
      store.upsertRealKey(current.layerId, sourceFrame, frameForCache, backgroundOnly, isPhysicsPaintProfilingEnabled() ? { mutationId, record: recordPhysicsPaintPerformance } : undefined);
      if (interpolationSettings) store.setInterpolationSettings(current.layerId, interpolationSettings);
      const manualFrames = upsertCachedRotoCacheFrame(latestFramesRef.current, frameForCache, backgroundOnly, onionFrame);
      const storeFrames = store.getCacheFrames(current.layerId);
      const settings = store.getInterpolationSettings(current.layerId);
      const refreshedFrames = settings.enabled && storeFrames.length > 0 ? storeFrames : manualFrames;
      const nextDisplayFrame = refreshedFrames.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === sourceFrame)?.displayFrame ?? sourceFrame;
      confirmedFramesRef.current = new Map(refreshedFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
      editBuffer.acceptPixelCache(sourceFrame);
      if (nextDisplayFrame !== sourceFrame) editBuffer.acceptPixelCache(nextDisplayFrame);
      if (expectedLayerId !== undefined) {
        queueParentPayload(sourceFrame, {
          operationId: `${current.operationId}:live-pixels:${sourceFrame}:${++parentOperationRevisionRef.current}`,
          kind: 'apply-canvas',
          layerId: current.layerId,
          startFrame: sourceFrame,
          sourceFrame,
          displayFrame: nextDisplayFrame,
          renderedFrame: frameForCache,
          rotoBackground: background ?? inputRef.current.getBackgroundMetadata(),
          rotoInterpolationSettings: settings,
          ...(backgroundOnly ? { backgroundOnly: true } : {}),
        }, mutationId);
      }
      const nextStartFrame = current.startFrame === frameForCache.displayFrame ? nextDisplayFrame : current.startFrame;
      const sameStartFrame = nextStartFrame === current.startFrame;
      const sameTopology = hasSameRotoCacheTopology(latestFramesRef.current, refreshedFrames);
      const sameSettings = hasSameRotoInterpolationSettings(current.rotoInterpolationSettings, settings);
      latestFramesRef.current = refreshedFrames;
      if (sameStartFrame && sameTopology && sameSettings) return current;
      return {
        ...current,
        startFrame: nextStartFrame,
        cachedRotoFrames: refreshedFrames,
        rotoInterpolationSettings: settings,
      };
    });
  }, [editBuffer, latestFramesRef, queueParentPayload, setLaunchContext, store]);

  const captureLivePixels = useCallback((inputCapture: {
    layerId: string;
    sourceFrame: number;
    liveAlphaCanvas: HTMLCanvasElement;
    cachedBase: RenderedFramePayload | null;
    size: { width: number; height: number };
    displayFrame: number;
    mutationId?: number;
    interpolationSettings?: PhysicPaintRotoInterpolationSettings;
    backgroundOnly?: boolean;
    operationId?: string;
    background?: PhysicPaintRotoBackgroundMetadata;
  }) => livePixelTransactionsRef.current.capture({
    sourceFrame: inputCapture.sourceFrame,
    mutationId: inputCapture.mutationId,
    recordPerformance: isPhysicsPaintProfilingEnabled() ? recordPhysicsPaintPerformance : undefined,
    produce: () => inputCapture.cachedBase
      ? mergeCachedRotoAlphaFrame(inputCapture.cachedBase, inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size, inputCapture.mutationId)
      : encodeRotoFrameFromCanvas(inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size, inputCapture.mutationId),
    commit: (renderedFrame) => upsertCachedFrame({ ...renderedFrame, displayFrame: inputCapture.displayFrame }, inputCapture.backgroundOnly === true, undefined, inputCapture.interpolationSettings, inputCapture.layerId, inputCapture.mutationId, inputCapture.operationId, inputCapture.background),
  }), [upsertCachedFrame]);

  const removeCachedFrame = useCallback((frame: number) => {
    livePixelTransactionsRef.current.remove(frame, () => {
      confirmedFramesRef.current.delete(frame);
      setLaunchContext((current) => {
        if (!current) return current;
        store.removeRealKey(current.layerId, frame);
        queueParentPayload(frame, {
          operationId: `${current.operationId}:live-pixels-remove:${frame}:${++parentOperationRevisionRef.current}`,
          kind: 'delete-roto-frame',
          layerId: current.layerId,
          startFrame: frame,
          sourceFrame: frame,
        });
        const refreshedFrames = removeCachedRotoCacheFrame(latestFramesRef.current, frame);
        latestFramesRef.current = refreshedFrames;
        return {
          ...current,
          cachedRotoFrames: refreshedFrames,
        };
      });
    });
  }, [latestFramesRef, queueParentPayload, setLaunchContext, store]);

  const clearCurrentFrame = useCallback((frame: number, size: { width: number; height: number }) => {
    livePixelTransactionsRef.current.invalidate(frame);
    const blankFrame = { ...buildBlankRotoFrame(size.width, size.height, frame), source: 'real-key' as const, sourceFrame: frame, displayFrame: frame };
    confirmedFramesRef.current.delete(frame);
    setLaunchContext((current) => {
      if (!current) return current;
      store.upsertRealKey(current.layerId, frame, blankFrame, true);
      const refreshedFrames = store.getCacheFrames(current.layerId);
      const settings = store.getInterpolationSettings(current.layerId);
      confirmedFramesRef.current = new Map(refreshedFrames.filter((candidate) => candidate.source === 'real-key').map((candidate) => [candidate.sourceFrame ?? candidate.appFrame, candidate]));
      editBuffer.setEditableFrameList((frames) => frames.filter((candidate) => candidate !== frame));
      queueParentPayload(frame, {
        operationId: `${current.operationId}:live-pixels-clear:${frame}:${++parentOperationRevisionRef.current}`,
        kind: 'apply-canvas',
        layerId: current.layerId,
        startFrame: frame,
        sourceFrame: frame,
        renderedFrame: blankFrame,
        backgroundOnly: true,
        rotoBackground: inputRef.current.getBackgroundMetadata(),
        rotoInterpolationSettings: settings,
      });
      latestFramesRef.current = refreshedFrames;
      return { ...current, startFrame: frame, cachedRotoFrames: refreshedFrames, rotoInterpolationSettings: settings };
    });
  }, [editBuffer, latestFramesRef, queueParentPayload, setLaunchContext, store]);

  const flushLivePixels = useCallback(async (sourceFrame?: number) => {
    await livePixelTransactionsRef.current.flush(sourceFrame);
    if (sourceFrame !== undefined) {
      await parentDeliveryRef.current.get(sourceFrame);
      return;
    }
    await Promise.all(parentDeliveryRef.current.values());
  }, []);

  const resetForLaunch = useCallback((frames?: readonly PhysicPaintRotoCacheFrame[]) => {
    const launchFrames = [...(frames ?? [])];
    latestFramesRef.current = launchFrames;
    editBuffer.resetForLaunch();
    confirmedFramesRef.current = new Map(launchFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    reference.resetCachedRotoReference();
  }, [editBuffer, latestFramesRef, reference.resetCachedRotoReference]);

  return {
    editBuffer,
    confirmedFramesRef,
    reference,
    upsertCachedFrame,
    captureLivePixels,
    invalidateLivePixels: livePixelTransactionsRef.current.invalidate,
    flushLivePixels,
    hasPendingLivePixels: () => livePixelTransactionsRef.current.hasPending() || parentDeliveryRef.current.size > 0,
    removeCachedFrame,
    clearCurrentFrame,
    resetForLaunch,
  };
}
