import { useCallback } from 'preact/hooks';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { seedRotoLaunchRealKeys } from '../roto/rotoLaunchHydration';
import { refreshRotoInterpolationCache } from '../roto/rotoCacheTransactions';
import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';

export function useRotoInterpolationController(input: {
  launchContext: PhysicPaintLaunchContext | null;
  getLatestFrames?: () => readonly PhysicPaintRotoCacheFrame[];
  currentFrame: number;
  bridgeMode: PhysicsPaintBridgeMode;
  updateSettings: (frame: number, patch: Partial<PhysicPaintRotoInterpolationSettings>) => { settings: PhysicPaintRotoInterpolationSettings; nextCurrentFrame: number; failureStatus: string | null; status: string };
  getStoreFrames: (layerId: string) => PhysicPaintRotoCacheFrame[];
  seedStore: Parameters<typeof seedRotoLaunchRealKeys>[1];
  setEditableFrames: (update: (frames: number[]) => number[]) => void;
  replaceConfirmedFrames: (frames: Map<number, PhysicPaintRotoCacheFrame>) => void;
  setLaunchContext: (update: (current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null) => void;
  sendFrameSync: (frame: number, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
  sendApplyPayload: (payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode) => Promise<void>;
  setApplyStatus: (status: 'success' | 'error') => void;
  setApplyMessage: (message: string) => void;
  setLastError: (message: string | null) => void;
  setPlaybackStatus: (message: string) => void;
  isMutationLocked?: () => boolean;
}) {
  const updateRotoInterpolationSettings = useCallback(async (patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    if (input.isMutationLocked?.()) return;
    const launchContext = input.launchContext;
    if (!launchContext) return;
    const latestFrames = [...(input.getLatestFrames?.() ?? launchContext.cachedRotoFrames ?? [])];
    seedRotoLaunchRealKeys({ ...launchContext, cachedRotoFrames: latestFrames }, input.seedStore);
    const transaction = input.updateSettings(input.currentFrame, patch);
    const cacheRefresh = refreshRotoInterpolationCache(latestFrames, input.getStoreFrames(launchContext.layerId), transaction.settings.enabled);
    if (!transaction.settings.enabled) {
      input.setEditableFrames((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)));
      input.replaceConfirmedFrames(new Map(cacheRefresh.confirmedRealKeys));
    }
    input.setLaunchContext((current) => current ? { ...current, startFrame: transaction.nextCurrentFrame, cachedRotoFrames: cacheRefresh.frames, rotoInterpolationSettings: transaction.settings } : current);
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-roto-interpolation-settings',
      operationId: `${launchContext.operationId}:roto-interpolation:${Date.now()}`,
      layerId: launchContext.layerId,
      startFrame: transaction.nextCurrentFrame,
      settings: transaction.settings,
    };
    try {
      await input.sendApplyPayload(payload, input.bridgeMode);
      if (transaction.nextCurrentFrame !== input.currentFrame) await input.sendFrameSync(transaction.nextCurrentFrame, input.bridgeMode);
    } catch (error) {
      const message = `Could not sync interpolation settings to EFX Motion. ${error instanceof Error ? error.message : String(error)}`;
      input.setApplyStatus('error');
      input.setApplyMessage(message);
      input.setLastError(message);
      return;
    }
    input.setApplyStatus(transaction.failureStatus ? 'error' : 'success');
    input.setApplyMessage(transaction.status);
    input.setLastError(transaction.failureStatus);
    input.setPlaybackStatus(transaction.status);
  }, [input]);

  return { updateRotoInterpolationSettings };
}
