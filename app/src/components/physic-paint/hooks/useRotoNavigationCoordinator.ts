import { useCallback, useRef } from 'preact/hooks';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { createRotoFrameDisplayPort } from '../roto/rotoCoordinatorPorts';
import { createRotoNavigationActions, getRotoNavigationTargets } from '../roto/rotoNavigationActions';
import { useRotoCachedPlayback, type RotoCachedPlaybackFrame } from './useRotoCachedPlayback';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';
import type { PhysicPaintRotoPhysicalTimelineProjection } from '../roto/physicsPaintRotoPhysicalResolver';

interface RotoNavigationRuntimePort {
  navigateToSyncedFrame: (frame: number) => Promise<boolean>;
}

export interface UseRotoNavigationCoordinatorInput<TPreview extends { appFrame: number }> {
  workflowMode: PhysicsPaintWorkflowMode;
  beforeNavigation?: (targetFrame: number) => Promise<boolean>;
  afterNavigation?: () => void;
  keyUtilities: Omit<RotoKeyUtilitiesInput, 'restoreFrame' | 'clearCanvas' | 'navigate' | 'clearCachedReferenceFrame'>;
  playback: {
    initialFps: number;
    getProjection: () => PhysicPaintRotoPhysicalTimelineProjection | null;
    getFrame: (appFrame: number) => TPreview | null;
    onStart: (frameCount: number) => void;
    onFrame: (frameIndex: number, appFrame: number) => void;
    setIsPlaying: (isPlaying: boolean) => void;
  };
}

export function useRotoNavigationCoordinator<TPreview extends { appFrame: number }>(input: UseRotoNavigationCoordinatorInput<TPreview>) {
  const inputRef = useRef(input);
  inputRef.current = input;
  const displayPortRef = useRef(createRotoFrameDisplayPort());
  const runtimePortRef = useRef<RotoNavigationRuntimePort>({
    navigateToSyncedFrame: async () => false,
  });

  const keyUtilities = useRotoKeyUtilities({
    ...input.keyUtilities,
    physicalKeyUtilities: input.keyUtilities.physicalKeyUtilities,
    restoreFrame: (effect, refreshedCacheFrames) => displayPortRef.current.restoreFrame(effect, refreshedCacheFrames),
    clearCanvas: (frame) => displayPortRef.current.clearCanvas(frame),
    navigate: (frame) => displayPortRef.current.navigate(frame),
    clearCachedReferenceFrame: (frame) => displayPortRef.current.clearCachedReferenceFrame(frame),
  });

  const playback = useRotoCachedPlayback({
    initialFps: input.playback.initialFps,
    workflowMode: input.workflowMode,
    getFrames: () => {
      const projection = input.playback.getProjection();
      const assignments = projection?.assignments ?? [];
      const lastRealFrame = assignments.length > 0 ? assignments[assignments.length - 1].appFrame : undefined;
      if (lastRealFrame === undefined) return [];
      return Array.from({ length: lastRealFrame + 1 }, (_, appFrame): RotoCachedPlaybackFrame<TPreview> => ({
        appFrame,
        frame: input.playback.getFrame(appFrame),
      }));
    },
    onStart: input.playback.onStart,
    onFrame: input.playback.onFrame,
    setIsPlaying: input.playback.setIsPlaying,
  });

  const requestNavigation = useCallback(async (targetFrame: number) => {
    if (!Number.isInteger(targetFrame) || targetFrame < 0) return false;
    const { beforeNavigation, afterNavigation } = inputRef.current;
    if (beforeNavigation && !await beforeNavigation(targetFrame)) return false;
    try {
      return await runtimePortRef.current.navigateToSyncedFrame(targetFrame);
    } finally {
      afterNavigation?.();
    }
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
    configureDisplayPort: (port: typeof displayPortRef.current) => { displayPortRef.current = port; },
    configureRuntimePort: (port: RotoNavigationRuntimePort) => { runtimePortRef.current = port; },
  };
}
