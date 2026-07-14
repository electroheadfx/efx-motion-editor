import { useCallback, useRef } from 'preact/hooks';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { createRotoFrameDisplayPort, createRotoKeyPersistencePort } from '../roto/rotoCoordinatorPorts';
import { createRotoNavigationActions, getRotoNavigationTargets } from '../roto/rotoNavigationActions';
import { useRotoCachedPlayback, type RotoCachedPlaybackFrame } from './useRotoCachedPlayback';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';

interface RotoNavigationRuntimePort {
  navigateToSyncedFrame: (frame: number) => Promise<boolean>;
}

export interface UseRotoNavigationCoordinatorInput<TPreview extends { appFrame: number }> {
  workflowMode: PhysicsPaintWorkflowMode;
  keyUtilities: Omit<RotoKeyUtilitiesInput<TPreview>, 'syncRotoKeyFrameLists' | 'applyRotoKeyFrames' | 'persistRotoKeyFrameTransaction' | 'restoreFrame' | 'clearCanvas' | 'navigate' | 'clearCachedReferenceFrame'>;
  playback: {
    initialFps: number;
    getFrame: (appFrame: number) => TPreview | null;
    onStart: (frameCount: number) => void;
    onFrame: (frameIndex: number, appFrame: number) => void;
    setIsPlaying: (isPlaying: boolean) => void;
  };
}

export function useRotoNavigationCoordinator<TPreview extends { appFrame: number }>(input: UseRotoNavigationCoordinatorInput<TPreview>) {
  const persistencePortRef = useRef(createRotoKeyPersistencePort());
  const displayPortRef = useRef(createRotoFrameDisplayPort());
  const runtimePortRef = useRef<RotoNavigationRuntimePort>({
    navigateToSyncedFrame: async () => false,
  });

  const keyUtilities = useRotoKeyUtilities({
    ...input.keyUtilities,
    syncRotoKeyFrameLists: (frames) => persistencePortRef.current.syncKeyFrameLists(frames),
    applyRotoKeyFrames: (transaction) => persistencePortRef.current.applyKeyFrames(transaction),
    persistRotoKeyFrameTransaction: (transaction) => persistencePortRef.current.persistKeyFrameTransaction(transaction),
    restoreFrame: (effect, refreshedCacheFrames) => displayPortRef.current.restoreFrame(effect, refreshedCacheFrames),
    clearCanvas: (frame) => displayPortRef.current.clearCanvas(frame),
    navigate: (frame) => displayPortRef.current.navigate(frame),
    clearCachedReferenceFrame: (frame) => displayPortRef.current.clearCachedReferenceFrame(frame),
  });

  const playback = useRotoCachedPlayback({
    initialFps: input.playback.initialFps,
    workflowMode: input.workflowMode,
    getFrames: () => keyUtilities.session.playbackFrameNumbers.value.map((appFrame): RotoCachedPlaybackFrame<TPreview> => ({
      appFrame,
      frame: input.playback.getFrame(appFrame),
    })),
    onStart: input.playback.onStart,
    onFrame: input.playback.onFrame,
    setIsPlaying: input.playback.setIsPlaying,
  });

  const requestNavigation = useCallback(async (targetFrame: number) => {
    if (!Number.isInteger(targetFrame) || targetFrame < 0) return false;
    return runtimePortRef.current.navigateToSyncedFrame(targetFrame);
  }, []);

  const createNavigationActions = useCallback((navigation: {
    currentFrame: number;
    framesToApply: number;
    savedFrames: readonly PhysicsPaintWorkflowStripFrameMarker[];
    playFrames: readonly { appFrame: number }[];
  }) => createRotoNavigationActions({
    getTargets: () => getRotoNavigationTargets(navigation),
    requestNavigation,
  }), [requestNavigation]);

  return {
    keyUtilities,
    playback,
    requestNavigation,
    createNavigationActions,
    resetForLaunch: () => {
      playback.resetForLaunch();
      keyUtilities.resetSession();
    },
    configurePersistencePort: (port: typeof persistencePortRef.current) => { persistencePortRef.current = port; },
    configureDisplayPort: (port: typeof displayPortRef.current) => { displayPortRef.current = port; },
    configureRuntimePort: (port: RotoNavigationRuntimePort) => { runtimePortRef.current = port; },
  };
}
