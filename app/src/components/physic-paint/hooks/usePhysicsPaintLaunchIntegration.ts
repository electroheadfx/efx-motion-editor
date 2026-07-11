import { useCallback, useEffect, useRef, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PendingPhysicPaintApply } from '../roto/rotoApplyTransactions';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { applyPhysicsPaintLaunchContext, getLaunchWorkflowMode } from '../bridge/physicsPaintLaunchContext';
import { hydrateRotoLaunchContext } from '../roto/rotoLaunchHydration';
import { applyPlayRenderOptionsSnapshotToSettings, applyRotoBackgroundMetadataToSettings, type PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { usePhysicsPaintLaunchBridge } from '../bridge/usePhysicsPaintParentBridge';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type ClosePromptState = 'idle' | 'prompt' | 'saving' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

interface LaunchLifecyclePorts {
  pendingAdvanceRef: MutableRef<number | null>;
  saveOnLeaveSourceFrameRef: MutableRef<number | null>;
  saveOnLeaveRenderedFrameRef: MutableRef<unknown | null>;
  pendingCachedMergeFrameRef: MutableRef<unknown | null>;
  saveOnLeaveDeleteFrameRef: MutableRef<number | null>;
  pendingApplyRef: MutableRef<PendingPhysicPaintApply | null>;
  activeOperationIdRef: MutableRef<string | null>;
  closeAfterApplyOperationIdRef: MutableRef<string | null>;
  closeAfterRotoSaveRequestedRef: MutableRef<boolean>;
  closeGuardBypassRef: MutableRef<boolean>;
  flushInFlightRef: MutableRef<Promise<PhysicPaintApplyPayload | null> | null>;
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
  setRotoSavingFrame: Dispatch<StateUpdater<number | null>>;
  setClosePromptState: Dispatch<StateUpdater<ClosePromptState>>;
  setClosePromptMessage: Dispatch<StateUpdater<string | null>>;
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

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext, preserveClose = false) => {
    if (getLaunchWorkflowMode(context) !== 'roto') return;
    input.resetPersistenceForLaunch(context.cachedRotoFrames);
    input.lifecycle.pendingAdvanceRef.current = null;
    input.lifecycle.saveOnLeaveSourceFrameRef.current = null;
    input.lifecycle.saveOnLeaveRenderedFrameRef.current = null;
    input.lifecycle.pendingCachedMergeFrameRef.current = null;
    input.lifecycle.saveOnLeaveDeleteFrameRef.current = null;
    if (!preserveClose) {
      input.lifecycle.closeAfterApplyOperationIdRef.current = null;
      input.lifecycle.closeAfterRotoSaveRequestedRef.current = false;
      input.lifecycle.closeGuardBypassRef.current = false;
      input.lifecycle.pendingApplyRef.current = null;
    }
    input.lifecycle.flushInFlightRef.current = null;
    input.resetNavigationForLaunchRef.current();
    input.state.setRotoSavingFrame(null);
    input.resetCachedReference();
    if (!preserveClose) {
      input.state.setClosePromptState('idle');
      input.state.setClosePromptMessage(null);
    }
  }, [input]);

  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    const hydratedContext = hydrateRotoLaunchContext(context, physicPaintStore);
    const preserveClose = input.lifecycle.closeAfterRotoSaveRequestedRef.current;
    resetRotoSessionForLaunch(hydratedContext, preserveClose);
    applyPhysicsPaintLaunchContext(hydratedContext, input.state, (launch) => {
      if (launch.playRenderOptions) return applyPlayRenderOptionsSnapshotToSettings(launch.playRenderOptions);
      if (getLaunchWorkflowMode(launch) === 'roto' && launch.rotoBackground) return applyRotoBackgroundMetadataToSettings(launch.rotoBackground);
      return null;
    });
    const readyEngine = input.engineRef.current;
    if (readyEngine && getLaunchWorkflowMode(hydratedContext) === 'roto') input.loadCachedReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine);
    if (!preserveClose) {
      input.state.setApplyStatus('idle');
      input.state.setApplyMessage(null);
      input.state.setLastError(null);
      input.lifecycle.activeOperationIdRef.current = null;
      input.lifecycle.pendingApplyRef.current = null;
      input.lifecycle.closeAfterApplyOperationIdRef.current = null;
      input.lifecycle.closeGuardBypassRef.current = false;
      input.state.setClosePromptState('idle');
      input.state.setClosePromptMessage(null);
    }
  }, [input, resetRotoSessionForLaunch]);

  usePhysicsPaintLaunchBridge(applyIncomingLaunchContext);
  return { getStrokeMetadata };
}
