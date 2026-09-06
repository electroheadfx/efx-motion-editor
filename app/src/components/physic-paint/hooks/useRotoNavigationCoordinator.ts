import { useCallback, useRef } from 'preact/hooks';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { createRotoFrameDisplayPort } from '../roto/rotoCoordinatorPorts';
import { createRotoNavigationActions, getRotoNavigationTargets } from '../roto/rotoNavigationActions';
import { useRotoCachedPlayback, type RotoCachedPlaybackFrame } from './useRotoCachedPlayback';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';
import type { SoloPlaybackWindow } from '../roto/physicsPaintRotoSoloWindow';
import type { PhysicPaintRotoPlaybackSettings } from '../../../types/physicPaint';

interface RotoNavigationRuntimePort {
  navigateToSyncedFrame: (frame: number) => Promise<boolean>;
}

export interface UseRotoNavigationCoordinatorInput<TPreview extends { appFrame: number }> {
  workflowMode: PhysicsPaintWorkflowMode;
  beforeNavigation?: (targetFrame: number) => Promise<boolean>;
  afterNavigation?: () => void;
  /**
   * 52.1-04 (D-10): neighbor prewarm hook — invoked on every playhead advance
   * (playback tick and seek-while-playing both funnel through `onFrame`). The
   * caller closes over its layerId and calls `prefetchNeighborFrames`; the
   * coordinator stays layer-agnostic. Absent = zero behavior change.
   */
  prefetchNeighbors?: (appFrame: number) => void;
  keyUtilities: Omit<RotoKeyUtilitiesInput, 'restoreFrame' | 'clearCanvas' | 'navigate' | 'clearCachedReferenceFrame'>;
  playback: {
    initialSettings: PhysicPaintRotoPlaybackSettings;
    getEndFrame: () => number | null;
    getFrame: (appFrame: number) => TPreview | null;
    /**
     * D-01 (260902-cfa amendment): the shared application-frame cursor at Play
     * press time — start() re-anchors visual + audio playback there. Absent
     * falls back to the range start.
     */
    getCurrentAppFrame?: () => number;
    /**
     * Optional solo playback window (43.6-06, D-17/D-19). Absent or null
     * returns the byte-identical pre-solo enumeration (disarmed = zero
     * behavior change). When present, the getFrames enumeration restricts to
     * [start, endExclusive) intersected with the playback end and yields
     * `{ appFrame, frame: null }` for in-range frames failing attribution —
     * the existing missing-frame treatment hides unselected content with zero
     * rendering changes. This is the ONLY place the solo filter lives; the
     * stopped-canvas display lookup (findCachedRotoDisplayFrame) stays
     * untouched (D-18, Pitfall 3).
     */
    getSoloWindow?: () => SoloPlaybackWindow | null;
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
    initialSettings: input.playback.initialSettings,
    workflowMode: input.workflowMode,
    getFrames: () => {
      const playbackEndFrame = input.playback.getEndFrame();
      if (playbackEndFrame === null || playbackEndFrame <= 0) return [];
      const soloWindow = input.playback.getSoloWindow?.() ?? null;
      if (soloWindow !== null) {
        const start = Math.max(0, soloWindow.start);
        const end = Math.min(soloWindow.endExclusive, playbackEndFrame);
        if (start >= end) return [];
        return Array.from({ length: end - start }, (_, index): RotoCachedPlaybackFrame<TPreview> => {
          const appFrame = start + index;
          return {
            appFrame,
            frame: soloWindow.includesFrame(appFrame) ? input.playback.getFrame(appFrame) : null,
          };
        });
      }
      return Array.from({ length: playbackEndFrame }, (_, appFrame): RotoCachedPlaybackFrame<TPreview> => ({
        appFrame,
        frame: input.playback.getFrame(appFrame),
      }));
    },
    onStart: input.playback.onStart,
    // 52.1-04 (D-10): neighbor prewarm rides the playback lookahead — every
    // playhead advance (playback tick + seek-while-playing) funnels through
    // onFrame, so prefetching here covers scrub cold-misses with the LRU +
    // neighbor prewarm (D-03). The just-drawn frame is most-recently-used, so
    // prewarm only evicts the distant tail behind the playhead.
    onFrame: (frameIndex, appFrame) => {
      inputRef.current.playback.onFrame(frameIndex, appFrame);
      inputRef.current.prefetchNeighbors?.(appFrame);
    },
    setIsPlaying: input.playback.setIsPlaying,
    getCurrentAppFrame: input.playback.getCurrentAppFrame,
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
    resetForLaunch: (settings: PhysicPaintRotoPlaybackSettings) => {
      playback.resetForLaunch(settings);
      keyUtilities.resetSession();
    },
    configureDisplayPort: (port: typeof displayPortRef.current) => { displayPortRef.current = port; },
    configureRuntimePort: (port: RotoNavigationRuntimePort) => { runtimePortRef.current = port; },
  };
}
