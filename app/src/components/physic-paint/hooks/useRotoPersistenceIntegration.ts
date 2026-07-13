import { useCallback, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import type { RotoKeyUtilityActiveRestore, RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import { mergeCachedRotoAlphaFrame } from '../roto/physicsPaintRotoAlphaMerge';
import { buildRotoBackgroundMetadata, type PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from '../bridge/physicsPaintBridgeTransport';
import { buildRotoOutputFrame, exportTransparentStrokeCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { isBackgroundOnlyRotoFrame, type RotoEditableState } from '../roto/rotoSaveTransactions';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import { useRotoCloseLifecycle } from '../hooks/useRotoCloseLifecycle';
import { useRotoSaveController } from './useRotoSaveController';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { resetBackground: () => void };
type RenderedSave = { renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null };

interface RotoNavigationIntegrationPort {
  playback: { stop: () => void };
  configurePersistencePort: (port: {
    syncKeyFrameLists: (frames?: readonly PhysicPaintRotoCacheFrame[]) => void;
    applyKeyFrames: (transaction: RotoKeyUtilityTransaction) => PhysicPaintRotoCacheFrame[];
    persistKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
    saveFrameBeforeContinuation: (effect: Extract<RotoSessionEffect, { type: 'saveFrame' }>) => Promise<boolean>;
  }) => void;
  configureDisplayPort: (port: {
    restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
    clearCanvas: (frame: number) => void;
    openAfterSave: (frame: number) => Promise<boolean>;
    clearCachedReferenceFrame: (frame: number) => void;
  }) => void;
  configureRuntimePort: (port: {
    navigateToSyncedFrame: (frame: number) => Promise<boolean>;
    snapshotCurrentFrame: () => void;
    getSaveOnLeaveSourceFrame: () => number | null;
    hasActiveOperation: () => boolean;
    queuePendingAdvance: (frame: number) => void;
  }) => void;
}

export interface UseRotoPersistenceIntegrationInput<TEditable extends RotoEditableState> {
  action: {
    getContext: () => { engine: EfxPaintEngine; launchContext: PhysicPaintLaunchContext; bridgeMode: PhysicsPaintBridgeMode } | null;
    bridgeMode: PhysicsPaintBridgeMode;
    readyToApply: boolean;
    registerPendingApply: (payload: PhysicPaintApplyPayload) => void;
    startApplyTimeout: (operationId: string) => void;
  };
  frame: {
    current: number;
    generated: boolean;
    canvasSize: { width: number; height: number };
    resolveSource: (frame: number) => number;
    snapshotCurrent: () => boolean;
    setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  };
  engine: EfxPaintEngine | null;
  launchContext: PhysicPaintLaunchContext | null;
  settings: PhysicsPaintStudioSettings;
  workflowMode: 'play' | 'roto';
  editBuffer: {
    frameStatesRef: MutableRef<Map<number, TEditable>>;
    previewFramesRef: MutableRef<Map<number, RenderedFramePayload>>;
    capturedFramesRef: MutableRef<Map<number, RenderedFramePayload>>;
    dirtyFramesRef: MutableRef<Set<number>>;
    addEditableFrame: (frame: number) => void;
    removeEditableFrame: (frame: number) => void;
  };
  reference: {
    cachedRepaintBaseFrame: RenderedFramePayload | null;
    setUrl: (url: string | null) => void;
    clearUrl: () => void;
    setRepaintBaseFrame: (frame: RenderedFramePayload | null) => void;
    loadFrame: (frame: number, engine: PreviewBackgroundEngine | null, refreshedFrame?: PhysicPaintRotoCacheFrame | null) => void;
  };
  cache: {
    confirmedFramesRef: MutableRef<Map<number, RenderedFramePayload>>;
    upsertFrame: (renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null, settings?: PhysicPaintRotoInterpolationSettings) => void;
    removeFrame: (frame: number) => void;
    saveRealKeyAtDisplayFrame: (frame: number) => { sourceFrameOverride: number; interpolationSettings: PhysicPaintRotoInterpolationSettings };
  };
  session: {
    savingFrame: { value: number | null };
    requestFrame: (frame: number) => unknown;
  };
  lifecycle: {
    activeOperationIdRef: MutableRef<string | null>;
    pendingAdvanceRef: MutableRef<number | null>;
    pendingFrameSyncRef: MutableRef<number | null>;
    saveOnLeaveSourceFrameRef: MutableRef<number | null>;
    saveOnLeaveRenderedFrameRef: MutableRef<RenderedSave | null>;
    pendingCachedMergeFrameRef: MutableRef<(RenderedSave & { frame: number }) | null>;
    saveOnLeaveDeleteFrameRef: MutableRef<number | null>;
    flushInFlightRef: MutableRef<Promise<PhysicPaintApplyPayload | null> | null>;
    closeGuardBypassRef: MutableRef<boolean>;
    closeAfterApplyOperationIdRef: MutableRef<string | null>;
    closeAfterRotoSaveRequestedRef: MutableRef<boolean>;
    pendingKeyActionMessageRef: MutableRef<string | null>;
  };
  navigation: RotoNavigationIntegrationPort;
  status: {
    applyStatus: ApplyStatus;
    setApplyStatus: (status: ApplyStatus) => void;
    setApplyMessage: (message: string | null) => void;
    setLastError: (message: string | null) => void;
    setSavingFrame: (frame: number | null) => void;
  };
  syncPendingFrames: () => void;
}

export function useRotoPersistenceIntegration<TEditable extends RotoEditableState>(input: UseRotoPersistenceIntegrationInput<TEditable>) {
  const { flushRotoFrame, saveRotoFrame, savePendingRotoFrames } = useRotoSaveController({
    getActionContext: input.action.getContext,
    getCurrentFrame: () => input.frame.current,
    getReadyToApply: () => input.action.readyToApply,
    getCurrentFrameIsGenerated: () => input.frame.generated,
    getCachedRepaintFrame: (frame) => input.reference.cachedRepaintBaseFrame?.appFrame === frame ? input.reference.cachedRepaintBaseFrame : null,
    getEditableState: (frame) => input.editBuffer.frameStatesRef.current.get(frame),
    setEditableState: (frame, state) => { input.editBuffer.frameStatesRef.current.set(frame, state as TEditable); },
    getCapturedFrame: (frame) => input.editBuffer.capturedFramesRef.current.get(frame),
    deleteCapturedFrame: (frame) => { input.editBuffer.capturedFramesRef.current.delete(frame); },
    setPreviewFrame: (frame, renderedFrame) => { input.editBuffer.previewFramesRef.current.set(frame, renderedFrame); },
    dirtyFramesRef: input.editBuffer.dirtyFramesRef,
    flushInFlightRef: input.lifecycle.flushInFlightRef,
    pendingAdvanceRef: input.lifecycle.pendingAdvanceRef,
    saveOnLeaveSourceFrameRef: input.lifecycle.saveOnLeaveSourceFrameRef,
    saveOnLeaveRenderedFrameRef: input.lifecycle.saveOnLeaveRenderedFrameRef,
    pendingCachedMergeFrameRef: input.lifecycle.pendingCachedMergeFrameRef,
    saveOnLeaveDeleteFrameRef: input.lifecycle.saveOnLeaveDeleteFrameRef,
    resolveSourceFrame: input.frame.resolveSource,
    getInterpolationSettings: (layerId) => physicPaintStore.getRotoInterpolationSettings(layerId),
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(input.settings),
    saveRealKeyAtDisplayFrame: input.cache.saveRealKeyAtDisplayFrame,
    snapshotCurrentFrame: input.frame.snapshotCurrent,
    renderFrame: async ({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame }) => {
      const backgroundOnly = isBackgroundOnlyRotoFrame(editableState);
      const liveAlphaCanvas = exportTransparentStrokeCanvas(engine);
      const renderedFrame = cachedRepaintBase
        ? await mergeCachedRotoAlphaFrame(cachedRepaintBase, liveAlphaCanvas, sourceFrame, input.frame.canvasSize)
        : { ...(capturedFrame ?? buildRotoOutputFrame(engine, frame, input.frame.canvasSize.width, input.frame.canvasSize.height)), appFrame: sourceFrame };
      return { renderedFrame, backgroundOnly, onionFrame: backgroundOnly ? null : renderedFrame, cachedRepaint: Boolean(cachedRepaintBase) };
    },
    resetBackground: (engine) => { (engine as PreviewBackgroundEngine).resetBackground(); },
    addEditableFrame: input.editBuffer.addEditableFrame,
    removeEditableFrame: input.editBuffer.removeEditableFrame,
    removeCachedFrame: input.cache.removeFrame,
    upsertCachedFrame: (save, settings) => input.cache.upsertFrame(save.renderedFrame, save.backgroundOnly, save.onionFrame, settings),
    setCachedReferenceUrl: input.reference.setUrl,
    restoreCachedRepaintFrame: input.reference.setRepaintBaseFrame,
    requestSessionFrame: (frame) => { void input.session.requestFrame(frame); },
    getSessionSavingFrame: () => input.session.savingFrame.value,
    registerPendingApply: input.action.registerPendingApply,
    sendApplyPayload: sendPhysicPaintApplyPayload,
    startApplyTimeout: input.action.startApplyTimeout,
    syncPendingFrames: input.syncPendingFrames,
    setApplyStatus: input.status.setApplyStatus,
    setApplyMessage: input.status.setApplyMessage,
    setLastError: input.status.setLastError,
    setSavingFrame: input.status.setSavingFrame,
  });

  const close = useRotoCloseLifecycle({
    workflowMode: input.workflowMode,
    currentFrame: input.frame.current,
    dirtyFramesRef: input.editBuffer.dirtyFramesRef,
    closeGuardBypassRef: input.lifecycle.closeGuardBypassRef,
    closeAfterApplyOperationIdRef: input.lifecycle.closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef: input.lifecycle.closeAfterRotoSaveRequestedRef,
    snapshotCurrentRotoFrame: input.frame.snapshotCurrent,
    saveCurrentRotoFrame: (options) => saveRotoFrame(null, options),
  });

  const openFrame = useCallback(async (frame: number, snapshot: boolean) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    if (snapshot && (input.lifecycle.flushInFlightRef.current || input.status.applyStatus === 'applying')) return false;
    input.navigation.playback.stop();
    input.reference.clearUrl();
    if (input.engine && input.launchContext) {
      if (snapshot) input.frame.snapshotCurrent();
      const nextState = input.editBuffer.frameStatesRef.current.get(frame);
      if (nextState) input.engine.load(nextState);
      else {
        (input.engine as PreviewBackgroundEngine).resetBackground();
        input.engine.clear();
        input.reference.loadFrame(frame, input.engine as PreviewBackgroundEngine);
      }
    }
    input.frame.setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    input.lifecycle.pendingFrameSyncRef.current = frame;
    await sendPhysicPaintFrameSyncMessage(frame, input.action.bridgeMode);
    return true;
  }, [input]);
  const navigateToSyncedFrame = useCallback((frame: number) => openFrame(frame, true), [openFrame]);
  const openAfterSave = useCallback((frame: number) => openFrame(frame, false), [openFrame]);

  const syncKeyFrameLists = useCallback((frames?: readonly PhysicPaintRotoCacheFrame[]) => {
    if (!frames) return;
    input.cache.confirmedFramesRef.current = new Map(frames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    input.frame.setLaunchContext((current) => current ? { ...current, cachedRotoFrames: [...frames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex) } : current);
  }, [input.cache.confirmedFramesRef, input.frame.setLaunchContext]);

  const applyKeyFrames = useCallback((transaction: RotoKeyUtilityTransaction) => {
    if (!input.launchContext) return [];
    const rotoInterpolationSettings = {
      ...physicPaintStore.getRotoInterpolationSettings(input.launchContext.layerId),
      segmentSpacingOverrides: [...transaction.segmentSpacingOverrides],
    };
    physicPaintStore.replaceRotoKeyFrames({ operationId: `${input.launchContext.operationId}:local-roto-keys:${Date.now()}`, kind: 'replace-roto-key-frames', layerId: input.launchContext.layerId, startFrame: transaction.activeFrame, frames: transaction.realKeyFrames, rotoInterpolationSettings });
    return physicPaintStore.getRotoCacheFrames(input.launchContext.layerId);
  }, [input.launchContext]);

  const persistKeyFrameTransaction = useCallback(async (transaction: RotoKeyUtilityTransaction) => {
    if (!input.launchContext || input.action.bridgeMode === 'Unavailable') throw new Error('App bridge is not connected.');
    if (transaction.realKeyFrames.length !== transaction.realKeyFrameNumbers.length) throw new Error('Roto key cache is incomplete after the action.');
    const operationId = `${input.launchContext.operationId}:roto-keys:${Date.now()}`;
    const payload: PhysicPaintApplyPayload & { rotoInterpolationSettings: PhysicPaintRotoInterpolationSettings } = { operationId, kind: 'replace-roto-key-frames', layerId: input.launchContext.layerId, startFrame: transaction.activeFrame, frames: transaction.realKeyFrames, rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(input.launchContext.layerId) };
    input.lifecycle.activeOperationIdRef.current = operationId;
    input.action.registerPendingApply(payload);
    input.lifecycle.pendingKeyActionMessageRef.current = transaction.successMessage;
    input.status.setApplyStatus('applying');
    input.status.setApplyMessage('Saving Roto key changes...');
    await sendPhysicPaintApplyPayload(payload, input.action.bridgeMode);
    input.action.startApplyTimeout(operationId);
  }, [input]);

  const restoreFrame = useCallback((effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => {
    const restore: RotoKeyUtilityActiveRestore = effect.restore;
    input.reference.setUrl(null);
    input.frame.setLaunchContext((current) => current ? { ...current, startFrame: restore.frame } : current);
    const refreshedFrame = refreshedCacheFrames?.find((frame) => (frame.displayFrame ?? frame.appFrame) === restore.frame) ?? null;
    if ((restore.kind === 'load-real-key' || restore.kind === 'blank-real-key') && input.engine) input.reference.loadFrame(restore.frame, input.engine as PreviewBackgroundEngine, refreshedFrame);
    else if (restore.kind === 'clear-blank' && input.engine) {
      (input.engine as PreviewBackgroundEngine).resetBackground();
      input.engine.clear();
    }
  }, [input]);

  input.navigation.configurePersistencePort({
    syncKeyFrameLists,
    applyKeyFrames,
    persistKeyFrameTransaction,
    saveFrameBeforeContinuation: async (effect) => {
      input.lifecycle.saveOnLeaveSourceFrameRef.current = effect.frame;
      input.status.setSavingFrame(effect.frame);
      input.lifecycle.pendingAdvanceRef.current = effect.after.type === 'navigate' ? effect.after.frame : null;
      input.status.setApplyStatus('applying');
      const action = effect.after.type === 'keyAction' ? effect.after.operation : null;
      input.status.setApplyMessage(effect.reason === 'beforeNavigate' ? `Saving frame ${effect.frame} before navigation...` : `Saving frame ${effect.frame} before ${action ?? 'key action'}...`);
      return Boolean(await flushRotoFrame(effect.frame, { force: true, advanceToFrame: effect.after.type === 'navigate' ? effect.after.frame : null }));
    },
  });
  input.navigation.configureDisplayPort({ restoreFrame, clearCanvas: (frame) => {
    input.reference.setUrl(null);
    if (input.engine && frame === input.frame.current) { (input.engine as PreviewBackgroundEngine).resetBackground(); input.engine.clear(); }
  }, openAfterSave, clearCachedReferenceFrame: input.cache.removeFrame });
  input.navigation.configureRuntimePort({ navigateToSyncedFrame, snapshotCurrentFrame: () => { input.frame.snapshotCurrent(); }, getSaveOnLeaveSourceFrame: () => input.lifecycle.saveOnLeaveSourceFrameRef.current, hasActiveOperation: () => Boolean(input.lifecycle.activeOperationIdRef.current), queuePendingAdvance: (frame) => { input.lifecycle.pendingAdvanceRef.current = frame; } });

  return { flushRotoFrame, saveRotoFrame, savePendingRotoFrames, openAfterSave, ...close };
}
