import { useCallback, useRef, useState } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';
import { annotatePlayFrameStrokes, findCachedPlayFrame, getCachedPlayFramesForRange, getLaunchPlayPreviewFrame } from './playFrameTransactions';

type PreviewBackgroundEngine = EfxPaintEngine & {
  setBackgroundImageUrl: (dataUrl: string) => void;
  clearPreviewBaseImage: () => void;
};

type PlayState = ReturnType<EfxPaintEngine['save']>;

export function usePlayEditCacheController<TFrame extends PhysicPaintRenderedFrame>(input: {
  launchContext: PhysicPaintLaunchContext | null;
  currentFrame: number;
  workflowMode: PhysicsPaintWorkflowMode;
  engine: EfxPaintEngine | null;
  getStoredFrame: (layerId: string, appFrame: number) => TFrame | null;
  setApplyMessage: (message: string | null) => void;
}) {
  const [latestFrames, setLatestFramesState] = useState<TFrame[]>([]);
  const [framesVersion, setFramesVersion] = useState(0);
  const [localPreviewFrame, setLocalPreviewFrameState] = useState(() => getLaunchPlayPreviewFrame(input.launchContext));
  const [cachedPreviewUrl, setCachedPreviewUrl] = useState<string | null>(null);
  const [cacheDirty, setCacheDirty] = useState(false);
  const latestFramesRef = useRef<TFrame[]>([]);
  const localPreviewFrameRef = useRef(localPreviewFrame);
  const editBaselineRef = useRef<{ frame: number; strokeCount: number } | null>(null);
  const editAssignmentsRef = useRef<Map<number, number>>(new Map());

  const setLatestFrames = useCallback((frames: TFrame[]) => {
    latestFramesRef.current = frames;
    setLatestFramesState(frames);
  }, []);

  const setLocalPreviewFrame = useCallback((frame: number) => {
    localPreviewFrameRef.current = frame;
    setLocalPreviewFrameState(frame);
  }, []);

  const findCachedFrame = useCallback((previewFrame: number) => findCachedPlayFrame<TFrame>({
    context: input.launchContext,
    currentFrame: input.currentFrame,
    previewFrame,
    latestFrames: latestFramesRef.current,
    getStoredFrame: input.getStoredFrame,
  }), [input.currentFrame, input.getStoredFrame, input.launchContext]);

  const loadCachedPreviewFrame = useCallback((previewFrame: number): boolean => {
    if (!input.launchContext) return false;
    if (cacheDirty) {
      setCachedPreviewUrl(null);
      if (input.engine && input.workflowMode === 'play') (input.engine as PreviewBackgroundEngine).clearPreviewBaseImage();
      return false;
    }
    const cachedFrame = findCachedFrame(previewFrame);
    setCachedPreviewUrl(cachedFrame?.dataUrl ?? null);
    if (input.engine && input.workflowMode === 'play') {
      const previewEngine = input.engine as PreviewBackgroundEngine;
      previewEngine.clearPreviewBaseImage();
      if (cachedFrame?.dataUrl) previewEngine.setBackgroundImageUrl(cachedFrame.dataUrl);
    }
    return Boolean(cachedFrame);
  }, [cacheDirty, findCachedFrame, input.engine, input.launchContext, input.workflowMode]);

  const getCachedFramesForRange = useCallback((frameCount: number) => getCachedPlayFramesForRange({
    frameCount,
    cacheDirty,
    findFrame: findCachedFrame,
  }), [cacheDirty, findCachedFrame]);

  const markSelectedCacheDirty = useCallback(() => {
    if (!input.launchContext?.selectedPlayScriptId) return;
    setCacheDirty(true);
  }, [input.launchContext?.selectedPlayScriptId]);

  const capturePendingFrameEdits = useCallback(() => {
    if (!input.engine || input.workflowMode !== 'play') return;
    const baseline = editBaselineRef.current;
    if (!baseline) return;
    const strokeCount = input.engine.getStrokeCount();
    for (let index = baseline.strokeCount; index < strokeCount; index += 1) {
      if (!editAssignmentsRef.current.has(index)) editAssignmentsRef.current.set(index, baseline.frame);
    }
    editBaselineRef.current = { frame: baseline.frame, strokeCount };
  }, [input.engine, input.workflowMode]);

  const beginFrameEdit = useCallback(() => {
    if (!input.engine || input.workflowMode !== 'play') return;
    capturePendingFrameEdits();
    editBaselineRef.current = { frame: localPreviewFrame, strokeCount: input.engine.getStrokeCount() };
    const cachedFrame = cacheDirty ? null : findCachedFrame(localPreviewFrame);
    const previewEngine = input.engine as PreviewBackgroundEngine;
    previewEngine.clearPreviewBaseImage();
    if (cachedFrame?.dataUrl) previewEngine.setBackgroundImageUrl(cachedFrame.dataUrl);
    if (cachedPreviewUrl) setCachedPreviewUrl(null);
    setCacheDirty(true);
    markSelectedCacheDirty();
  }, [cacheDirty, cachedPreviewUrl, capturePendingFrameEdits, findCachedFrame, input.engine, input.workflowMode, localPreviewFrame, markSelectedCacheDirty]);

  const previewLocalFrame = useCallback((frame: number) => {
    capturePendingFrameEdits();
    const previewFrame = Math.max(0, Math.trunc(frame));
    setLocalPreviewFrame(previewFrame);
    if (input.engine && input.workflowMode === 'play') {
      editBaselineRef.current = { frame: previewFrame, strokeCount: input.engine.getStrokeCount() };
    }
    loadCachedPreviewFrame(previewFrame);
    input.setApplyMessage(`Previewing Play frame ${previewFrame}.`);
  }, [capturePendingFrameEdits, input.engine, input.setApplyMessage, input.workflowMode, loadCachedPreviewFrame, setLocalPreviewFrame]);

  const annotateState = useCallback((state: PlayState): PlayState => annotatePlayFrameStrokes(state, editAssignmentsRef.current), []);
  const resetFrameEdits = useCallback(() => {
    editAssignmentsRef.current = new Map();
    editBaselineRef.current = null;
  }, []);
  const restoreFrameEdits = useCallback((assignments: Map<number, number>, frame: number, strokeCount: number) => {
    editAssignmentsRef.current = assignments;
    editBaselineRef.current = { frame, strokeCount };
  }, []);
  const bumpFramesVersion = useCallback(() => setFramesVersion((version) => version + 1), []);

  return {
    latestFrames,
    latestFramesRef,
    framesVersion,
    localPreviewFrame,
    localPreviewFrameRef,
    cachedPreviewUrl,
    cacheDirty,
    editAssignmentsRef,
    setLatestFrames,
    setLocalPreviewFrame,
    setCachedPreviewUrl,
    setCacheDirty,
    bumpFramesVersion,
    findCachedFrame,
    loadCachedPreviewFrame,
    getCachedFramesForRange,
    markSelectedCacheDirty,
    capturePendingFrameEdits,
    beginFrameEdit,
    previewLocalFrame,
    annotateState,
    resetFrameEdits,
    restoreFrameEdits,
    clearFrames: () => setLatestFrames([]),
    clampFrameCount: clampPhysicPaintFrameCount,
  };
}
