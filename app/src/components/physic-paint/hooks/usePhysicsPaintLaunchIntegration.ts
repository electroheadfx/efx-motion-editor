import { useCallback, useEffect, useRef, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PendingPhysicPaintApply } from '../roto/rotoApplyTransactions';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { applyPhysicsPaintLaunchContext, getLaunchWorkflowMode } from '../bridge/physicsPaintLaunchContext';
import { hydrateRotoLaunchContext } from '../roto/rotoLaunchHydration';
import { applyPlayRenderOptionsSnapshotToSettings, applyRotoBackgroundMetadataToSettings, type PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { usePhysicsPaintLaunchBridge } from '../bridge/usePhysicsPaintParentBridge';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

export interface PhysicsPaintLaunchReplacementCoordinator {
  request: (context: PhysicPaintLaunchContext) => void;
  dispose: () => void;
}

export function createPhysicsPaintLaunchReplacementCoordinator(input: {
  prepareReplacement: () => Promise<void>;
  applyLatest: (context: PhysicPaintLaunchContext) => void;
}): PhysicsPaintLaunchReplacementCoordinator {
  let latest: PhysicPaintLaunchContext | null = null;
  let running = false;
  let disposed = false;

  const run = async () => {
    if (running || disposed || !latest) return;
    running = true;
    try {
      await input.prepareReplacement();
      if (disposed) return;
      const context = latest;
      latest = null;
      if (context) input.applyLatest(context);
    } catch (error) {
      console.error('[PhysicsPaintStudio] launch replacement handoff failed', error);
    } finally {
      running = false;
      if (!disposed && latest) void run();
    }
  };

  return {
    request: (context) => {
      if (disposed) return;
      latest = context;
      void run();
    },
    dispose: () => {
      disposed = true;
      latest = null;
    },
  };
}

interface LaunchLifecyclePorts {
  pendingFrameSyncRef: MutableRef<number | null>;
  pendingApplyRef: MutableRef<PendingPhysicPaintApply | null>;
  activeOperationIdRef: MutableRef<string | null>;
  prepareScriptLaunchReplacement: () => Promise<void>;
  completeScriptLaunchReplacement: () => void;
}

interface LaunchStatePorts {
  setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  setFramesToApply: Dispatch<StateUpdater<number>>;
  setWorkflowMode: Dispatch<StateUpdater<PhysicsPaintWorkflowMode>>;
  setLocalPlayPreviewFrame: (frame: number) => void;
  setSavedPlayCacheDirty: Dispatch<StateUpdater<boolean>>;
  setPlayWiggle: Dispatch<StateUpdater<AnimationWiggleConfig>>;
  setSettings: Dispatch<StateUpdater<PhysicsPaintStudioSettings>>;
  setApplyStatus: Dispatch<StateUpdater<ApplyStatus>>;
  setApplyMessage: Dispatch<StateUpdater<string | null>>;
  setLastError: Dispatch<StateUpdater<string | null>>;
}

export function usePhysicsPaintLaunchIntegration(input: {
  workflowMode: PhysicsPaintWorkflowMode;
  localPreviewFrameRef: MutableRef<number>;
  engineRef: MutableRef<EfxPaintEngine | null>;
  lifecycle: LaunchLifecyclePorts;
  state: LaunchStatePorts;
  resetPersistenceForLaunch: (frames: PhysicPaintLaunchContext['cachedRotoFrames']) => void;
  resetNavigationForLaunchRef: MutableRef<() => void>;
  resetCachedReference: () => void;
  loadCachedReferenceFrame: (frame: number, engine?: PreviewBackgroundEngine) => void;
}) {
  const workflowModeRef = useRef<PhysicsPaintWorkflowMode>(input.workflowMode);
  useEffect(() => { workflowModeRef.current = input.workflowMode; }, [input.workflowMode]);

  const getStrokeMetadata = useCallback(() => {
    if (workflowModeRef.current !== 'play') return null;
    const playFrame = input.localPreviewFrameRef.current;
    return Number.isInteger(playFrame) && playFrame >= 0 ? { playFrame } : null;
  }, [input.localPreviewFrameRef]);

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext) => {
    input.lifecycle.completeScriptLaunchReplacement();
    if (getLaunchWorkflowMode(context) !== 'roto') return;
    input.resetPersistenceForLaunch(context.cachedRotoFrames);
    input.lifecycle.pendingApplyRef.current = null;
    input.resetNavigationForLaunchRef.current();
    input.resetCachedReference();
  }, [input]);

  const applySettledLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    const pendingFrame = input.lifecycle.pendingFrameSyncRef.current;
    input.lifecycle.pendingFrameSyncRef.current = null;
    const incomingContext = pendingFrame !== null && getLaunchWorkflowMode(context) === 'roto'
      ? { ...context, startFrame: pendingFrame }
      : context;
    const hydratedContext = hydrateRotoLaunchContext(incomingContext, physicPaintStore);
    resetRotoSessionForLaunch(hydratedContext);
    applyPhysicsPaintLaunchContext(hydratedContext, input.state, (launch) => {
      if (launch.playRenderOptions) return applyPlayRenderOptionsSnapshotToSettings(launch.playRenderOptions);
      if (getLaunchWorkflowMode(launch) === 'roto' && launch.rotoBackground) return applyRotoBackgroundMetadataToSettings(launch.rotoBackground);
      return null;
    });
    const readyEngine = input.engineRef.current;
    if (readyEngine && getLaunchWorkflowMode(hydratedContext) === 'roto') input.loadCachedReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine);
    input.state.setApplyStatus('idle');
    input.state.setApplyMessage(null);
    input.state.setLastError(null);
    input.lifecycle.activeOperationIdRef.current = null;
    input.lifecycle.pendingApplyRef.current = null;
  }, [input, resetRotoSessionForLaunch]);

  const prepareReplacementRef = useRef(input.lifecycle.prepareScriptLaunchReplacement);
  const applySettledLaunchContextRef = useRef(applySettledLaunchContext);
  prepareReplacementRef.current = input.lifecycle.prepareScriptLaunchReplacement;
  applySettledLaunchContextRef.current = applySettledLaunchContext;
  const coordinatorRef = useRef<PhysicsPaintLaunchReplacementCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: () => prepareReplacementRef.current(),
      applyLatest: (context) => applySettledLaunchContextRef.current(context),
    });
  }
  useEffect(() => () => coordinatorRef.current?.dispose(), []);
  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    coordinatorRef.current?.request(context);
  }, []);

  usePhysicsPaintLaunchBridge(applyIncomingLaunchContext);
  return { getStrokeMetadata };
}
