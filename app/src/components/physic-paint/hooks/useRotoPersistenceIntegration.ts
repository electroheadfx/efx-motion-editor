import { useCallback, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import type { RotoKeyUtilityActiveRestore, RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import { sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from '../bridge/physicsPaintBridgeTransport';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { resetBackground: () => void };

interface RotoNavigationIntegrationPort {
  playback: { stop: () => void };
  configurePersistencePort: (port: {
    syncKeyFrameLists: (frames?: readonly PhysicPaintRotoCacheFrame[]) => void;
    applyKeyFrames: (transaction: RotoKeyUtilityTransaction) => PhysicPaintRotoCacheFrame[];
    persistKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
  }) => void;
  configureDisplayPort: (port: {
    restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
    clearCanvas: (frame: number) => void;
    navigate: (frame: number) => Promise<boolean>;
    clearCachedReferenceFrame: (frame: number) => void;
  }) => void;
  configureRuntimePort: (port: { navigateToSyncedFrame: (frame: number) => Promise<boolean> }) => void;
}

export interface UseRotoPersistenceIntegrationInput {
  action: {
    bridgeMode: PhysicsPaintBridgeMode;
    registerPendingApply: (payload: PhysicPaintApplyPayload) => void;
    startApplyTimeout: (operationId: string) => void;
  };
  frame: {
    current: number;
    setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  };
  engine: EfxPaintEngine | null;
  launchContext: PhysicPaintLaunchContext | null;
  reference: {
    setUrl: (url: string | null) => void;
    loadFrame: (frame: number, engine: PreviewBackgroundEngine | null, refreshedFrame?: PhysicPaintRotoCacheFrame | null) => void;
  };
  cache: {
    confirmedFramesRef: MutableRef<Map<number, RenderedFramePayload>>;
    latestFramesRef: MutableRef<PhysicPaintRotoCacheFrame[]>;
    removeFrame: (frame: number) => void;
  };
  lifecycle: {
    activeOperationIdRef: MutableRef<string | null>;
    pendingFrameSyncRef: MutableRef<number | null>;
    pendingKeyActionMessageRef: MutableRef<string | null>;
  };
  navigation: RotoNavigationIntegrationPort;
  status: {
    setApplyStatus: (status: ApplyStatus) => void;
    setApplyMessage: (message: string | null) => void;
  };
}

export function useRotoPersistenceIntegration(input: UseRotoPersistenceIntegrationInput) {
  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    input.navigation.playback.stop();
    input.reference.setUrl(null);
    if (input.engine && input.launchContext) {
      (input.engine as PreviewBackgroundEngine).resetBackground();
      input.engine.clear();
      input.reference.loadFrame(frame, input.engine as PreviewBackgroundEngine);
    }
    input.frame.setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    input.lifecycle.pendingFrameSyncRef.current = frame;
    await sendPhysicPaintFrameSyncMessage(frame, input.action.bridgeMode);
    return true;
  }, [input]);

  const syncKeyFrameLists = useCallback((frames?: readonly PhysicPaintRotoCacheFrame[]) => {
    if (!frames) return;
    const sortedFrames = [...frames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
    input.cache.latestFramesRef.current = sortedFrames;
    input.cache.confirmedFramesRef.current = new Map(sortedFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    input.frame.setLaunchContext((current) => current ? { ...current, cachedRotoFrames: sortedFrames } : current);
  }, [input.cache.confirmedFramesRef, input.cache.latestFramesRef, input.frame.setLaunchContext]);

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

  input.navigation.configurePersistencePort({ syncKeyFrameLists, applyKeyFrames, persistKeyFrameTransaction });
  input.navigation.configureDisplayPort({
    restoreFrame,
    clearCanvas: (frame) => {
      input.reference.setUrl(null);
      if (input.engine && frame === input.frame.current) {
        (input.engine as PreviewBackgroundEngine).resetBackground();
        input.engine.clear();
      }
    },
    navigate: navigateToSyncedFrame,
    clearCachedReferenceFrame: input.cache.removeFrame,
  });
  input.navigation.configureRuntimePort({ navigateToSyncedFrame });
}
