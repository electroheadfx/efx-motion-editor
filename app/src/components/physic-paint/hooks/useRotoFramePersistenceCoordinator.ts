import { useCallback, useRef } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { buildBlankRotoFrame, buildRotoFrameFromCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { mergeCachedRotoAlphaFrame } from '../roto/physicsPaintRotoAlphaMerge';
import { createRotoLivePixelCacheTransactions } from '../roto/rotoLivePixelCacheTransactions';
import { removeCachedRotoCacheFrame, upsertCachedRotoCacheFrame } from '../roto/rotoCacheTransactions';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { useRotoReferenceController } from './useRotoReferenceController';

interface RotoPersistenceStorePort {
  getRotoFrame: (layerId: string, frame: number) => RenderedFramePayload | null;
  getFrame: (layerId: string, frame: number) => RenderedFramePayload | null;
  upsertRealKey: (layerId: string, frame: number, renderedFrame: PhysicPaintRotoCacheFrame, backgroundOnly: boolean) => void;
  removeRealKey: (layerId: string, frame: number) => boolean;
  getCacheFrames: (layerId: string) => PhysicPaintRotoCacheFrame[];
  getInterpolationSettings: (layerId: string) => PhysicPaintRotoInterpolationSettings;
  setInterpolationSettings: (layerId: string, settings: PhysicPaintRotoInterpolationSettings) => void;
}

export interface UseRotoFramePersistenceCoordinatorInput {
  workflowMode: PhysicsPaintWorkflowMode;
  backgroundMode: BgMode;
  launchContext: PhysicPaintLaunchContext | null;
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
  const queueParentPayload = useCallback((sourceFrame: number, payload: PhysicPaintApplyPayload) => {
    const previous = parentDeliveryRef.current.get(sourceFrame) ?? Promise.resolve();
    const delivery = previous
      .catch(() => undefined)
      .then(() => input.sendCachePayload(payload))
      .catch((error) => { console.error('[PhysicsPaintStudio] Roto cache delivery failed', error); });
    parentDeliveryRef.current.set(sourceFrame, delivery);
    void delivery.then(() => {
      if (parentDeliveryRef.current.get(sourceFrame) === delivery) parentDeliveryRef.current.delete(sourceFrame);
    });
  }, [input]);
  const reference = useRotoReferenceController<RenderedFramePayload>({
    workflowMode: input.workflowMode,
    settingsBackground: input.backgroundMode,
    cachedRotoFrames: input.launchContext?.cachedRotoFrames,
    previewFrames: buffer.previewFrames,
    confirmedFrames: confirmedFramesRef.current,
    dirtyFrames: buffer.dirtyFrames,
    liveOverlayActionCounts: buffer.liveOverlayActionCounts,
    getRotoFrame: (frame) => input.launchContext ? input.store.getRotoFrame(input.launchContext.layerId, frame) : null,
    getFrame: (frame) => input.launchContext ? input.store.getFrame(input.launchContext.layerId, frame) : null,
    syncPending: input.syncPending,
    setApplyMessage: input.setApplyMessage,
  });

  const upsertCachedFrame = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null, interpolationSettings?: PhysicPaintRotoInterpolationSettings, expectedLayerId?: string) => {
    const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame;
    const normalized = { ...renderedFrame, appFrame: sourceFrame };
    input.setLaunchContext((current) => {
      if (!current || (expectedLayerId !== undefined && current.layerId !== expectedLayerId)) return current;
      confirmedFramesRef.current.set(sourceFrame, normalized);
      const frameForCache = { ...normalized, source: 'real-key' as const, sourceFrame, displayFrame: renderedFrame.displayFrame ?? sourceFrame };
      input.store.upsertRealKey(current.layerId, sourceFrame, frameForCache, backgroundOnly);
      if (interpolationSettings) input.store.setInterpolationSettings(current.layerId, interpolationSettings);
      const manualFrames = upsertCachedRotoCacheFrame(current.cachedRotoFrames, frameForCache, backgroundOnly, onionFrame);
      const storeFrames = input.store.getCacheFrames(current.layerId);
      const settings = input.store.getInterpolationSettings(current.layerId);
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
          rotoBackground: input.getBackgroundMetadata(),
          rotoInterpolationSettings: settings,
          ...(backgroundOnly ? { backgroundOnly: true } : {}),
        });
      }
      return {
        ...current,
        startFrame: current.startFrame === frameForCache.displayFrame ? nextDisplayFrame : current.startFrame,
        cachedRotoFrames: refreshedFrames,
        rotoInterpolationSettings: settings,
      };
    });
  }, [editBuffer, input]);

  const captureLivePixels = useCallback((inputCapture: {
    layerId: string;
    sourceFrame: number;
    liveAlphaCanvas: HTMLCanvasElement;
    cachedBase: RenderedFramePayload | null;
    size: { width: number; height: number };
    displayFrame: number;
    interpolationSettings?: PhysicPaintRotoInterpolationSettings;
    backgroundOnly?: boolean;
  }) => livePixelTransactionsRef.current.capture({
    sourceFrame: inputCapture.sourceFrame,
    produce: () => inputCapture.cachedBase
      ? mergeCachedRotoAlphaFrame(inputCapture.cachedBase, inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size)
      : buildRotoFrameFromCanvas(inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size),
    commit: (renderedFrame) => upsertCachedFrame({ ...renderedFrame, displayFrame: inputCapture.displayFrame }, inputCapture.backgroundOnly === true, undefined, inputCapture.interpolationSettings, inputCapture.layerId),
  }), [upsertCachedFrame]);

  const removeCachedFrame = useCallback((frame: number) => {
    livePixelTransactionsRef.current.remove(frame, () => {
      confirmedFramesRef.current.delete(frame);
      input.setLaunchContext((current) => {
        if (!current) return current;
        input.store.removeRealKey(current.layerId, frame);
        queueParentPayload(frame, {
          operationId: `${current.operationId}:live-pixels-remove:${frame}:${++parentOperationRevisionRef.current}`,
          kind: 'delete-roto-frame',
          layerId: current.layerId,
          startFrame: frame,
          sourceFrame: frame,
        });
        return {
          ...current,
          cachedRotoFrames: removeCachedRotoCacheFrame(current.cachedRotoFrames, frame),
        };
      });
    });
  }, [input, queueParentPayload]);

  const clearCurrentFrame = useCallback((frame: number, size: { width: number; height: number }) => {
    livePixelTransactionsRef.current.invalidate(frame);
    const blankFrame = { ...buildBlankRotoFrame(size.width, size.height, frame), source: 'real-key' as const, sourceFrame: frame, displayFrame: frame };
    confirmedFramesRef.current.delete(frame);
    input.setLaunchContext((current) => {
      if (!current) return current;
      input.store.upsertRealKey(current.layerId, frame, blankFrame, true);
      const refreshedFrames = input.store.getCacheFrames(current.layerId);
      const settings = input.store.getInterpolationSettings(current.layerId);
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
        rotoBackground: input.getBackgroundMetadata(),
        rotoInterpolationSettings: settings,
      });
      return { ...current, startFrame: frame, cachedRotoFrames: refreshedFrames, rotoInterpolationSettings: settings };
    });
  }, [editBuffer, input, queueParentPayload]);

  const resetForLaunch = useCallback((frames?: readonly PhysicPaintRotoCacheFrame[]) => {
    editBuffer.resetForLaunch();
    confirmedFramesRef.current = new Map((frames ?? []).filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    reference.resetCachedRotoReference();
  }, [editBuffer, reference.resetCachedRotoReference]);

  return {
    editBuffer,
    confirmedFramesRef,
    reference,
    upsertCachedFrame,
    captureLivePixels,
    invalidateLivePixels: livePixelTransactionsRef.current.invalidate,
    removeCachedFrame,
    clearCurrentFrame,
    resetForLaunch,
  };
}
