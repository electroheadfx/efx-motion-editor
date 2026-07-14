import { useCallback, useRef } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { addOccupiedRotoFrame, buildBlankRotoFrame, buildRotoFrameFromCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
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
  setApplyMessage: (message: string) => void;
}

export function useRotoFramePersistenceCoordinator(input: UseRotoFramePersistenceCoordinatorInput) {
  const editBuffer = useRotoEditBufferController<ReturnType<import('@efxlab/efx-physic-paint').EfxPaintEngine['save']>, RenderedFramePayload>();
  const confirmedFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const livePixelTransactionsRef = useRef(createRotoLivePixelCacheTransactions());
  const buffer = editBuffer.bufferRef.current;
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
      const previousDisplayFrame = current.startFrame;
      const frameForCache = { ...normalized, source: 'real-key' as const, sourceFrame, displayFrame: sourceFrame };
      input.store.upsertRealKey(current.layerId, sourceFrame, frameForCache, backgroundOnly);
      if (interpolationSettings) input.store.setInterpolationSettings(current.layerId, interpolationSettings);
      const manualFrames = upsertCachedRotoCacheFrame(current.cachedRotoFrames, frameForCache, backgroundOnly, onionFrame);
      const storeFrames = input.store.getCacheFrames(current.layerId);
      const settings = input.store.getInterpolationSettings(current.layerId);
      const refreshedFrames = settings.enabled && storeFrames.length > 0 ? storeFrames : manualFrames;
      const nextDisplayFrame = refreshedFrames.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === sourceFrame)?.appFrame ?? sourceFrame;
      confirmedFramesRef.current = new Map(refreshedFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
      editBuffer.setEditableFrameList((frames) => {
        const withoutStaleFrames = frames.filter((frame) => frame !== previousDisplayFrame && frame !== sourceFrame && frame !== nextDisplayFrame);
        return backgroundOnly ? withoutStaleFrames : addOccupiedRotoFrame(withoutStaleFrames, nextDisplayFrame);
      });
      return { ...current, startFrame: nextDisplayFrame, cachedRotoFrames: refreshedFrames, rotoInterpolationSettings: settings };
    });
  }, [editBuffer, input]);

  const captureLivePixels = useCallback((inputCapture: {
    layerId: string;
    sourceFrame: number;
    liveAlphaCanvas: HTMLCanvasElement;
    cachedBase: RenderedFramePayload | null;
    size: { width: number; height: number };
    backgroundOnly?: boolean;
  }) => livePixelTransactionsRef.current.capture({
    sourceFrame: inputCapture.sourceFrame,
    produce: () => inputCapture.cachedBase
      ? mergeCachedRotoAlphaFrame(inputCapture.cachedBase, inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size)
      : buildRotoFrameFromCanvas(inputCapture.liveAlphaCanvas, inputCapture.sourceFrame, inputCapture.size),
    commit: (renderedFrame) => upsertCachedFrame(renderedFrame, inputCapture.backgroundOnly === true, undefined, undefined, inputCapture.layerId),
  }), [upsertCachedFrame]);

  const removeCachedFrame = useCallback((frame: number) => {
    livePixelTransactionsRef.current.remove(frame, () => {
      confirmedFramesRef.current.delete(frame);
      input.setLaunchContext((current) => current ? {
        ...current,
        cachedRotoFrames: removeCachedRotoCacheFrame(current.cachedRotoFrames, frame),
      } : current);
    });
  }, [input]);

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
      return { ...current, startFrame: frame, cachedRotoFrames: refreshedFrames, rotoInterpolationSettings: settings };
    });
  }, [editBuffer, input]);

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
