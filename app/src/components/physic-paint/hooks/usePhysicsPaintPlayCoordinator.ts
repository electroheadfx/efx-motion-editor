import { useCallback, useEffect } from 'preact/hooks';
import type { Dispatch, StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../physicsPaintWorkflowState';
import type { PhysicsPaintBridgeMode } from '../usePhysicsPaintParentBridge';
import type { PhysicsPaintStudioSettings } from '../physicsPaintStudioSettings';
import { buildPlayRenderOptionsSnapshot } from '../physicsPaintStudioSettings';
import { selectCurrentPlayCacheStatus, selectPlayConversionMissingFrames } from '../physicsPaintStudioSelectors';
import { getActivePlayStartFrame } from '../play/playFrameTransactions';
import { applyRenderedPlayCache, markPlayLaunchCacheStale, normalizePlayMotionUpdate, resolvePlayFrameCountUpdate, resolvePlayOptionsUpdate } from '../play/playLifecycleTransactions';
import { usePlayEditCacheController } from './usePlayEditCacheController';
import { usePlayPreviewController } from './usePlayPreviewController';

type PlayState = ReturnType<EfxPaintEngine['save']>;
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { resetBackground: () => void };

interface PlayApplyLifecyclePort {
  setActiveOperationId: (operationId: string | null) => void;
  clearPendingApply: () => void;
  registerPendingApply: (payload: PhysicPaintApplyPayload) => void;
  startApplyTimeout: (operationId: string) => void;
}

export function usePhysicsPaintPlayCoordinator<TFrame extends PhysicPaintRenderedFrame>(input: {
  engine: EfxPaintEngine | null;
  launchContext: PhysicPaintLaunchContext | null;
  setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  currentFrame: number;
  workflowMode: PhysicsPaintWorkflowMode;
  previewFps: number;
  framesToApply: number;
  setFramesToApply: (frameCount: number) => void;
  settings: PhysicsPaintStudioSettings;
  playWiggle: AnimationWiggleConfig;
  setPlayWiggle: (wiggle: AnimationWiggleConfig) => void;
  readyToApply: boolean;
  bridgeMode: PhysicsPaintBridgeMode;
  getStoredFrame: (layerId: string, appFrame: number) => TFrame | null;
  stopRotoPlayback: () => void;
  setIsPlaying: (value: boolean) => void;
  setAnimFrame: (value: number) => void;
  setAnimTotal: (value: number) => void;
  setApplyStatus: (status: ApplyStatus) => void;
  setApplyMessage: (message: string | null) => void;
  setLastError: (message: string | null) => void;
  showLimit: (message: string) => void;
  applyLifecycle: PlayApplyLifecyclePort;
  sendApplyPayload: (payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
}) {
  const editCache = usePlayEditCacheController<TFrame>({
    launchContext: input.launchContext,
    currentFrame: input.currentFrame,
    workflowMode: input.workflowMode,
    engine: input.engine,
    getStoredFrame: input.getStoredFrame,
    setApplyMessage: input.setApplyMessage,
  });
  const previewController = usePlayPreviewController<TFrame>({
    engine: input.engine,
    previewFps: input.previewFps,
    wiggle: input.playWiggle,
    getCachedFrames: editCache.getCachedFramesForRange,
    capturePendingFrameEdits: editCache.capturePendingFrameEdits,
    annotateState: editCache.annotateState as (state: PlayState) => PlayState,
    setCachedPreviewUrl: editCache.setCachedPreviewUrl,
    setApplyMessage: input.setApplyMessage,
    stopRotoPlayback: input.stopRotoPlayback,
    setIsPlaying: input.setIsPlaying,
    setAnimFrame: input.setAnimFrame,
    setAnimTotal: input.setAnimTotal,
  });

  useEffect(() => {
    if (input.workflowMode !== 'play') return;
    if (editCache.cacheDirty) return;
    editCache.loadCachedPreviewFrame(editCache.localPreviewFrame);
  }, [input.engine, input.launchContext, editCache.localPreviewFrame, editCache.cacheDirty, input.workflowMode]);

  const updateFrameCount = useCallback((frameCount: number) => {
    const update = resolvePlayFrameCountUpdate({
      requestedFrameCount: frameCount,
      maxFrameCount: input.launchContext?.maxPlayFrameCount,
      maxFrameCountReason: input.launchContext?.maxPlayFrameCountReason,
    });
    if (update.limitMessage) input.showLimit(update.limitMessage);
    input.setFramesToApply(update.frameCount);
    if (input.workflowMode !== 'play') return;
    editCache.setCachedPreviewUrl(null);
    editCache.setCacheDirty(true);
    editCache.markSelectedCacheDirty();
    input.setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playFrameCount: update.frameCount }) : current);
  }, [input.launchContext?.maxPlayFrameCount, input.launchContext?.maxPlayFrameCountReason, input.showLimit, input.workflowMode, editCache.markSelectedCacheDirty]);

  const updateWiggle = useCallback((wiggle: AnimationWiggleConfig) => {
    const normalized = normalizePlayMotionUpdate(wiggle);
    input.setPlayWiggle(normalized);
    if (input.workflowMode !== 'play') return;
    editCache.setCachedPreviewUrl(null);
    editCache.setCacheDirty(true);
    editCache.markSelectedCacheDirty();
    input.setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playMotion: normalized }) : current);
  }, [editCache.markSelectedCacheDirty, input.workflowMode]);

  const updateSelectedOptions = useCallback(async () => {
    if (!input.engine || !input.launchContext || input.workflowMode !== 'play') return null;
    const scriptId = input.launchContext.selectedPlayScriptId;
    if (!scriptId) {
      input.setApplyStatus('error');
      input.setApplyMessage('No saved Play script is selected to update.');
      return null;
    }
    const renderOptions = buildPlayRenderOptionsSnapshot(input.settings, input.playWiggle);
    const operationId = `${input.launchContext.operationId}:update-play-options:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-play-render-options', operationId, layerId: input.launchContext.layerId,
      startFrame: getActivePlayStartFrame(input.launchContext, input.currentFrame), playScriptId: scriptId, renderOptions,
    };
    try {
      input.setApplyStatus('applying');
      input.setApplyMessage('Updating Play options...');
      input.setLastError(null);
      input.applyLifecycle.setActiveOperationId(operationId);
      input.applyLifecycle.registerPendingApply(payload);
      await input.sendApplyPayload(payload, input.bridgeMode);
      input.applyLifecycle.startApplyTimeout(operationId);
      const changed = resolvePlayOptionsUpdate({ context: input.launchContext, renderOptions }).changed;
      input.setLaunchContext((current) => current ? resolvePlayOptionsUpdate({ context: current, renderOptions }).context : current);
      if (changed) {
        editCache.setLatestFrames([]);
        editCache.setCachedPreviewUrl(null);
        editCache.setCacheDirty(true);
        editCache.bumpFramesVersion();
        input.setApplyMessage('Play options updated. Cached frames cleared; use Render play.');
      } else input.setApplyMessage('Play options already up to date.');
      return payload;
    } catch (error) {
      input.applyLifecycle.setActiveOperationId(null);
      input.applyLifecycle.clearPendingApply();
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not update Play options. ${detail}`;
      input.setApplyStatus('error');
      input.setApplyMessage(message);
      input.setLastError(message);
      return null;
    }
  }, [input.currentFrame, input.engine, input.launchContext, input.playWiggle, input.settings, input.workflowMode]);

  const savePlay = useCallback(async () => {
    if (!input.engine || !input.launchContext || !input.readyToApply) return null;
    const frameCount = clampPhysicPaintFrameCount(input.framesToApply);
    const playStartFrame = getActivePlayStartFrame(input.launchContext, input.currentFrame);
    const renderOptions = buildPlayRenderOptionsSnapshot(input.settings, input.playWiggle);
    editCache.capturePendingFrameEdits();
    const editableState = editCache.annotateState(input.engine.save());
    (input.engine as PreviewBackgroundEngine).resetBackground();
    input.engine.load(editableState);
    try {
      input.setApplyStatus('applying');
      input.setApplyMessage('Applying physics paint output...');
      input.setLastError(null);
      const operationId = `${input.launchContext.operationId}:play:${Date.now()}`;
      input.applyLifecycle.setActiveOperationId(operationId);
      const frames = await previewController.renderFrames({ frameCount, startFrame: playStartFrame });
      const payload: PhysicPaintApplyPayload = {
        operationId, kind: 'apply-play-canvas', layerId: input.launchContext.layerId, startFrame: playStartFrame,
        frameCount, frames, editableState, playScriptId: input.launchContext.selectedPlayScriptId,
        playMotion: input.playWiggle, renderOptions,
      };
      editCache.setLatestFrames(frames);
      editCache.setCachedPreviewUrl(frames[0]?.dataUrl ?? null);
      editCache.setCacheDirty(false);
      editCache.setLocalPreviewFrame(0);
      editCache.bumpFramesVersion();
      editCache.resetFrameEdits();
      input.setLaunchContext((current) => current ? applyRenderedPlayCache({ context: current, currentFrame: input.currentFrame, frameCount, frames, motion: input.playWiggle, renderOptions }) : current);
      input.applyLifecycle.registerPendingApply(payload);
      await input.sendApplyPayload(payload, input.bridgeMode);
      input.applyLifecycle.startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      previewController.stopPlayOnly();
      input.applyLifecycle.setActiveOperationId(null);
      input.applyLifecycle.clearPendingApply();
      input.setIsPlaying(false);
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      input.setApplyStatus('error');
      input.setApplyMessage(message);
      input.setLastError(message);
      return null;
    }
  }, [input.currentFrame, input.engine, input.framesToApply, input.launchContext, input.playWiggle, input.readyToApply, input.settings, previewController.renderFrames, previewController.stopPlayOnly]);

  return {
    ...editCache,
    preview: previewController.preview,
    stopPreview: previewController.stop,
    updateFrameCount,
    updateWiggle,
    updateSelectedOptions,
    savePlay,
    currentCacheStatus: selectCurrentPlayCacheStatus({ workflowMode: input.workflowMode, cacheDirty: editCache.cacheDirty, hasCachedRange: Boolean(editCache.getCachedFramesForRange(input.framesToApply)) }),
    missingConversionFrames: selectPlayConversionMissingFrames({ hasLaunchContext: Boolean(input.launchContext), currentFrame: input.currentFrame, requestedFrameCount: input.framesToApply, latestFrames: editCache.latestFramesRef.current }),
  };
}
