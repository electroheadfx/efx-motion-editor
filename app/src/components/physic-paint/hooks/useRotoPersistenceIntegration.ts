import { useCallback, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import type { RotoKeyMoveTransaction, RotoKeyUtilityActiveRestore, RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { RotoMoveSettlementOutcome } from './useRotoApplyLifecycle';
import type { RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import { sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from '../bridge/physicsPaintBridgeTransport';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { resetBackground: () => void };

export function clearRotoEngineCanvas(engine: PreviewBackgroundEngine): void {
  engine.clearPreviewBaseImage();
  engine.resetBackground();
  engine.clear();
}

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
    registerMoveSettlement: (
      payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }>,
      settle: (outcome: RotoMoveSettlementOutcome) => void,
    ) => void;
    settleMoveTransportFailure: (operationId: string, error: unknown) => boolean;
    startApplyTimeout: (operationId: string) => void;
  };
  frame: {
    current: number;
    source: number;
    setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  };
  engine: EfxPaintEngine | null;
  launchContext: PhysicPaintLaunchContext | null;
  flushFramePublication: (sourceFrame: number) => Promise<void>;
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

export interface RotoKeyMovePersistenceIdentity {
  launchOperationId: string;
  layerId: string;
}

export interface RotoKeyMoveReplacement {
  activeFrame: number;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
}

export interface CommitRotoKeyMoveInput {
  identity: RotoKeyMovePersistenceIdentity;
  transaction: RotoKeyMoveTransaction;
  onSettlement: (outcome: RotoMoveSettlementOutcome) => void | Promise<void>;
}

export function useRotoPersistenceIntegration(input: UseRotoPersistenceIntegrationInput) {
  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    input.navigation.playback.stop();
    if (input.launchContext) {
      const sourceFrame = input.frame.source;
      input.engine?.flushPendingStrokeFinalizations();
      try {
        await input.flushFramePublication(sourceFrame);
      } catch {
        input.status.setApplyStatus('error');
        input.status.setApplyMessage(`Could not save Roto frame ${input.frame.current} before navigation.`);
        return false;
      }
      input.reference.setUrl(null);
      if (input.engine) {
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

  const syncKeyFrameLists = useCallback((frames?: readonly PhysicPaintRotoCacheFrame[]) => {
    if (!frames) return;
    const sortedFrames = [...frames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
    input.cache.latestFramesRef.current = sortedFrames;
    input.cache.confirmedFramesRef.current = new Map(sortedFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    input.frame.setLaunchContext((current) => current ? { ...current, cachedRotoFrames: sortedFrames } : current);
  }, [input.cache.confirmedFramesRef, input.cache.latestFramesRef, input.frame.setLaunchContext]);

  const replaceRotoKeyMoveLocal = useCallback((
    replacement: RotoKeyMoveReplacement,
    identity: RotoKeyMovePersistenceIdentity,
  ): PhysicPaintRotoCacheFrame[] => {
    const current = input.launchContext;
    if (!current || current.layerId !== identity.layerId || current.operationId !== identity.launchOperationId) {
      throw new Error('The Physics Paint launch changed before the Roto key move could be applied.');
    }
    physicPaintStore.replaceRotoKeyFrames({
      operationId: `${identity.launchOperationId}:local-roto-key-move:${crypto.randomUUID()}`,
      kind: 'replace-roto-key-frames',
      layerId: identity.layerId,
      startFrame: replacement.activeFrame,
      frames: replacement.realKeyFrames.map((frame) => ({ ...frame })),
      rotoInterpolationSettings: {
        ...replacement.interpolationSettings,
        segmentSpacingOverrides: replacement.interpolationSettings.segmentSpacingOverrides?.map((override) => ({ ...override })) ?? [],
      },
    });
    const refreshedFrames = physicPaintStore.getRotoCacheFrames(identity.layerId);
    syncKeyFrameLists(refreshedFrames);
    return refreshedFrames;
  }, [input.launchContext, syncKeyFrameLists]);

  const commitRotoKeyMove = useCallback(async ({ identity, transaction, onSettlement }: CommitRotoKeyMoveInput): Promise<boolean> => {
    const current = input.launchContext;
    if (!current || current.layerId !== identity.layerId || current.operationId !== identity.launchOperationId) return false;
    if (input.action.bridgeMode === 'Unavailable') return false;
    const operationId = `${identity.launchOperationId}:roto-key-move:${crypto.randomUUID()}`;
    const payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-key-frames' }> = {
      operationId,
      kind: 'replace-roto-key-frames',
      layerId: identity.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames.map((frame) => ({ ...frame })),
      rotoInterpolationSettings: {
        ...transaction.interpolationSettings,
        segmentSpacingOverrides: transaction.interpolationSettings.segmentSpacingOverrides?.map((override) => ({ ...override })) ?? [],
      },
    };
    let resolveSettlement: (accepted: boolean) => void = () => {};
    const settlement = new Promise<boolean>((resolve) => { resolveSettlement = resolve; });
    input.action.registerMoveSettlement(payload, (outcome) => {
      void Promise.resolve(onSettlement(outcome))
        .then(() => resolveSettlement(outcome.type === 'accepted'))
        .catch((error) => {
          console.error('[PhysicsPaintStudio] Roto key move settlement failed', error);
          resolveSettlement(false);
        });
    });
    try {
      replaceRotoKeyMoveLocal({
        activeFrame: transaction.activeFrame,
        realKeyFrames: transaction.realKeyFrames,
        interpolationSettings: transaction.interpolationSettings,
      }, identity);
      input.lifecycle.pendingKeyActionMessageRef.current = transaction.successMessage;
      input.status.setApplyStatus('applying');
      input.status.setApplyMessage('Moving Roto key...');
      await sendPhysicPaintApplyPayload(payload, input.action.bridgeMode);
      input.action.startApplyTimeout(operationId);
    } catch (error) {
      input.lifecycle.pendingKeyActionMessageRef.current = null;
      if (!input.action.settleMoveTransportFailure(operationId, error)) resolveSettlement(false);
    }
    return settlement;
  }, [input, replaceRotoKeyMoveLocal]);

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
      clearRotoEngineCanvas(input.engine as PreviewBackgroundEngine);
    }
  }, [input]);

  input.navigation.configurePersistencePort({ syncKeyFrameLists, applyKeyFrames, persistKeyFrameTransaction });
  input.navigation.configureDisplayPort({
    restoreFrame,
    clearCanvas: (frame) => {
      input.reference.setUrl(null);
      if (input.engine && frame === input.frame.current) {
        clearRotoEngineCanvas(input.engine as PreviewBackgroundEngine);
      }
    },
    navigate: navigateToSyncedFrame,
    clearCachedReferenceFrame: input.cache.removeFrame,
  });
  input.navigation.configureRuntimePort({ navigateToSyncedFrame });

  return {
    replaceRotoKeyMoveLocal,
    commitRotoKeyMove,
  };
}
