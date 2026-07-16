import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, type PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { physicPaintStore } from '../../stores/physicPaintStore';
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './view/physicsPaintWorkflowPresentation';
import { getPreviewFps } from './play/physicsPaintPlayWorkflow';
import { getSourceRotoFrameForDisplayFrame } from './roto/physicsPaintRotoWorkflow';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectProjectedRealCachedRotoFrames, selectRealCachedRotoSourceFrameNumbers, selectRotoTimelineView } from './roto/rotoTimelineSelectors';
import { useRotoNavigationCoordinator } from './hooks/useRotoNavigationCoordinator';
import { useRotoFramePersistenceCoordinator } from './hooks/useRotoFramePersistenceCoordinator';
import { useRotoApplyLifecycle } from './hooks/useRotoApplyLifecycle';
import { useRotoFrameEditingController } from './hooks/useRotoFrameEditingController';
import { useRotoPersistenceIntegration } from './hooks/useRotoPersistenceIntegration';
import { normalizePlayWiggle } from './play/playFrameTransactions';
import { usePhysicsPaintPlayCoordinator } from './hooks/usePhysicsPaintPlayCoordinator';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './engine/physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './engine/usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './engine/usePhysicsPaintEngineActions';
import { useRotoBackgroundMetadataSync } from './hooks/useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './roto/rotoOnionPreview';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './view/physicsPaintStudioSelectors';
import { usePlayLimitToast } from './hooks/usePlayLimitToast';
import { buildPlayRenderOptionsSnapshot, buildRotoBackgroundMetadata, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './engine/physicsPaintStudioSettings';
import { getLaunchWorkflowMode, parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from './bridge/physicsPaintBridgeTransport';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintBridgeMode, usePhysicsPaintCloseFlush, type PhysicsPaintBridgeMode } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from './performance/physicsPaintPerformanceTrace';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoInterpolationController } from './hooks/useRotoInterpolationController';
import { useRotoScriptClipboardController } from './hooks/useRotoScriptClipboardController';
import { claimRotoSelectedFrame } from './roto/rotoKeyTransactions';
import './physicsPaintStudio.css';
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };
interface PhysicsPaintActionContext { engine: EfxPaintEngine; launchContext: PhysicPaintLaunchContext; bridgeMode: PhysicsPaintBridgeMode }
export function PhysicsPaintStudio() {
  const profilePerformance = isPhysicsPaintProfilingEnabled();
  const recordEnginePerformance = profilePerformance
    ? (sample: PaintPerformanceSample) => recordPhysicsPaintPerformance(sample)
    : undefined;
  const [isPlaying, setIsPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [animTotal, setAnimTotal] = useState(0);
  const [launchContext, setLaunchContextState] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(launchContext?.cachedRotoFrames ?? []);
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      if (next?.cachedRotoFrames !== current?.cachedRotoFrames) latestRotoFramesRef.current = next?.cachedRotoFrames ?? [];
      return next;
    });
  }, []);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const [lastError, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [framesToApply, setFramesToApply] = useState(() => clampPhysicPaintFrameCount(launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialPhysicsPaintStudioSettings());
  const [workflowMode, setWorkflowMode] = useState<PhysicsPaintWorkflowMode>(() => getLaunchWorkflowMode(launchContext));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const historyAvailability = useSignal<PaintHistoryAvailability>({ undo: 0, redo: 0 });
  const [onion, setOnionState] = useState<PhysicsPaintOnionState>(() => ({
    ...DEFAULT_ONION_STATE,
    opacity: Math.round(paintStore.onionSkinOpacity.value * 100),
  }));
  const setOnion = useCallback((next: PhysicsPaintOnionState | ((current: PhysicsPaintOnionState) => PhysicsPaintOnionState)) => {
    setOnionState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      paintStore.onionSkinOpacity.value = resolved.opacity / 100;
      return resolved;
    });
  }, []);
  const [playWiggle, setPlayWiggle] = useState<AnimationWiggleConfig>(() => normalizePlayWiggle(launchContext?.playMotion ?? DEFAULT_PLAY_WIGGLE));
  const resetRotoKeySessionRef = useRef<(options?: { clearClipboard?: boolean }) => void>(() => {});
  const rotoPersistence = useRotoFramePersistenceCoordinator({
    workflowMode,
    backgroundMode: settings.background,
    launchContext,
    latestFramesRef: latestRotoFramesRef,
    setLaunchContext,
    store: {
      getRotoFrame: (layerId, frame) => physicPaintStore.getRotoFrame(layerId, frame),
      getFrame: (layerId, frame) => physicPaintStore.getFrame(layerId, frame),
      upsertRealKey: (layerId, frame, renderedFrame, backgroundOnly, diagnostics) => physicPaintStore.upsertRealRotoKeyFrame(layerId, frame, renderedFrame, backgroundOnly, diagnostics),
      removeRealKey: (layerId, frame) => physicPaintStore.removeRealRotoKeyFrame(layerId, frame),
      getCacheFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId),
      getInterpolationSettings: (layerId) => physicPaintStore.getRotoInterpolationSettings(layerId),
      setInterpolationSettings: (layerId, interpolationSettings) => physicPaintStore.setRotoInterpolationSettings(layerId, interpolationSettings),
    },
    syncPending: () => resetRotoKeySessionRef.current(),
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    sendCachePayload: async (payload) => sendPhysicPaintApplyPayload(
      payload,
      bridgeMode === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : bridgeMode,
    ),
    setApplyMessage,
  });
  const rotoEditBuffer = rotoPersistence.editBuffer;
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const playLimitToast = usePlayLimitToast();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const confirmedCachedRotoFramesRef = rotoPersistence.confirmedFramesRef;
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const pendingFrameSyncRef = useRef<number | null>(null);
  const resetRotoNavigationForLaunchRef = useRef<() => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current({ clearClipboard: false });
  }, []);
  const { activeOperationIdRef, pendingApplyRef, registerPendingApply, clearActiveApply, matchApplyResult, startApplyTimeout } = useRotoApplyLifecycle({
    onTimeout: (transition) => {
      setApplyStatus('error');
      setApplyMessage(transition.message);
      setLastError(transition.message);
      pendingRotoKeyActionMessageRef.current = null;
    },
  });
  const projectCanvasWidth = launchContext?.width ?? DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH;
  const projectCanvasHeight = launchContext?.height ?? DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT;
  const workingCanvasSize = getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight);
  const canvasWidth = workingCanvasSize.width;
  const canvasHeight = workingCanvasSize.height;
  const paperTextureScale = canvasWidth / projectCanvasWidth;
  const canvasKey = `${canvasWidth}x${canvasHeight}`;
  const { engine, engineRef, canvasMounted, setCanvasMounted, handleEngineReady, handleNativePenInputReady } = usePhysicsPaintEngineLifecycle({
    canvasKey,
    canvasWidth,
    canvasHeight,
    launchContext,
    setLastError,
    clearExternalState: () => {
      pendingFrameSyncRef.current = null;
    },
  });
  const currentFrame = launchContext?.startFrame ?? 0;
  const previewFps = getPreviewFps(launchContext?.fps);
  const actionContext = useMemo<PhysicsPaintActionContext | null>(() => {
    if (!engine || !launchContext) return null;
    return { engine, launchContext: { ...launchContext, cachedRotoFrames: latestRotoFramesRef.current }, bridgeMode };
  }, [bridgeMode, engine, launchContext]);
  const resolveRotoSourceFrameForDisplayFrame = useCallback((displayFrame: number) => {
    if (!launchContext) return displayFrame;
    return getSourceRotoFrameForDisplayFrame(
      displayFrame,
      selectRealCachedRotoSourceFrameNumbers(latestRotoFramesRef.current),
      physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    ) ?? displayFrame;
  }, [launchContext?.layerId]);
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: latestRotoFramesRef.current,
    interpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
    currentFrame,
  });
  const rotoTimelineActions = useRotoTimelineActions({
    getModel: () => rotoTimelineModel.view.value.model,
    getStoreRealKeyFrames: () => launchContext ? selectRealCachedRotoSourceFrameNumbers(latestRotoFramesRef.current) : [],
    getCurrentSettings: () => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
    setInterpolationSettings: (settings) => {
      if (!launchContext) return settings;
      physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, settings);
      return physicPaintStore.getRotoInterpolationSettings(launchContext.layerId);
    },
    getStoreRotoFrames: () => launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : [],
    getFailureStatus: () => launchContext ? physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId) : null,
  });
  const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value;
  const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value;
  const timelineCachedRotoFrames = rotoTimelineModel.cachedRotoFrames.value;
  const currentFrameSelectionKind = rotoTimelineModel.currentFrameSelectionKind.value;
  const currentFrameOwnerSourceFrame = rotoTimelineModel.currentFrameOwnerSourceFrame.value;
  const currentFrameIsGeneratedRoto = workflowMode === 'roto' && currentFrameSelectionKind === 'generated-interpolation';
  const [rotoScriptNavigationLocked, setRotoScriptNavigationLocked] = useState(false);
  const { cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, setCachedRotoReferenceUrl, clearCachedRotoReferenceUrl, resetCachedRotoReference, findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame } = rotoPersistence.reference;
  const rotoScript = useRotoScriptClipboardController({
    getEngine: () => engineRef.current,
    getSource: () => ({
      workflowMode,
      selectionKind: currentFrameSelectionKind,
      layerId: launchContext?.layerId ?? null,
      sourceFrame: currentFrameSelectionKind === 'real-key'
        ? (currentFrameOwnerSourceFrame ?? currentFrame)
        : currentFrame,
      displayFrame: currentFrame,
    }),
    getMotion: () => ({
      deformation: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).deform : 0,
      position: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).position : 0,
    }),
    getPublicationIdentity: () => launchContext ? {
      operationId: launchContext.operationId,
      layerId: launchContext.layerId,
      cachedBase: cachedRotoRepaintBaseFrame,
      background: buildRotoBackgroundMetadata(settings),
    } : null,
    claimEmptyTarget: () => launchContext ? claimRotoSelectedFrame({
      model: rotoTimelineModel.view.value.model,
      selectedFrame: currentFrame,
      currentSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    }) : null,
    flushSourcePublication: (sourceFrame) => rotoPersistence.flushLivePixels(sourceFrame),
    onFirstAcceptedBrush: () => acceptRotoScriptBrushRef.current(),
    setNavigationLocked: setRotoScriptNavigationLocked,
  });
  rotoScript.updateEngine(engineRef.current);
  rotoScript.updateSource({
    workflowMode,
    selectionKind: currentFrameSelectionKind,
    layerId: launchContext?.layerId ?? null,
    sourceFrame: currentFrameSelectionKind === 'real-key'
      ? (currentFrameOwnerSourceFrame ?? currentFrame)
      : currentFrame,
    displayFrame: currentFrame,
  });
  usePhysicsPaintCloseFlush(
    () => workflowMode === 'roto' && Boolean(engineRef.current?.getStrokeCount() || rotoPersistence.hasPendingLivePixels()),
    async () => {
      if (workflowMode !== 'roto') return;
      engineRef.current?.flushPendingStrokeFinalizations();
      await rotoPersistence.flushLivePixels(currentFrameOwnerSourceFrame ?? currentFrame);
    },
  );
  const mutationLocked = rotoScript.mutationLocked.value;
  const rotoInputDisabled = currentFrameIsGeneratedRoto || mutationLocked;
  const {
    selectTool,
    setBrushColor,
    setBrushSize,
    setBrushOpacity,
    setBackground,
    setPaperGrain,
    setGrainStrength,
    setEdgeDetail,
    setPickup,
    setSpread,
    setSmoothing,
    setEraseStrength,
    startPhysics,
    stopPhysics,
  } = usePhysicsPaintEngineActions({ engine, settings, setSettings, isMutationLocked: rotoScript.mutationLocked.peek });
  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    keyUtilities: {
      currentFrame,
      realKeyFrames: selectProjectedRealCachedRotoFrames(latestRotoFramesRef.current, rotoTimelineModel.view.value.projection),
      cachedRotoFrames: latestRotoFramesRef.current,
      dirtyFrames: dirtyRotoFramesRef.current,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      applyStatus,
      flushInFlight: false,
      buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
      resolveSourceFrameForDisplayFrame: resolveRotoSourceFrameForDisplayFrame,
      resolveDisplayFrameForSourceFrame: (sourceFrame, transaction) => {
        const projection = selectRotoTimelineView({
          cachedRotoFrames: transaction.realKeyFrames,
          interpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
          currentFrame: sourceFrame,
        }).projection;
        return projection.realKeys.find((key) => key.sourceFrame === sourceFrame)?.displayFrame ?? null;
      },
      resolvePasteTargetForDisplayFrame: (displayFrame) => launchContext ? rotoTimelineActions.saveRealKeyAtDisplayFrame(displayFrame).target : null,
      segmentSpacingOverrides: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).segmentSpacingOverrides : undefined,
      getPreviewFrames: () => rotoPreviewFramesRef.current,
      setPreviewFrames: (frames) => { rotoPreviewFramesRef.current = frames as Map<number, RenderedFramePayload>; },
      setDirtyFrames: (frames) => { dirtyRotoFramesRef.current = frames; },
      syncPendingRotoFrames,
      showCachedReference: (frame) => setCachedRotoReferenceUrl(frame.dataUrl),
      clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, frame, 1); },
      clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, frame); },
      setApplyMessage,
      setApplyStatus,
      setLastError,
    },
    playback: {
      initialFps: getPreviewFps(launchContext?.fps),
      getFrame: findCachedRotoDisplayFrame,
      onStart: (frameCount) => setAnimTotal(frameCount),
      onFrame: (frameIndex) => {
        setAnimFrame(frameIndex);
      },
      setIsPlaying,
    },
  });
  const rotoKeyUtilities = rotoNavigation.keyUtilities;
  const rotoSession = rotoKeyUtilities.session;
  const duplicateRotoKey = rotoKeyUtilities.duplicateKey;
  const insertRotoFrame = rotoKeyUtilities.insertBlankKey;
  const deleteRotoFrame = rotoKeyUtilities.deleteKey;
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;
  const rotoCachedPlayback = rotoNavigation.playback;
  resetRotoKeySessionRef.current = rotoKeyUtilities.resetSession;
  resetRotoNavigationForLaunchRef.current = rotoNavigation.resetForLaunch;
  const rotoFrameEditing = useRotoFrameEditingController({
    workflowMode, currentFrame, currentFrameSourceFrame: currentFrameOwnerSourceFrame, currentFrameSelectionKind,
    canvasSize: { width: canvasWidth, height: canvasHeight }, engine, launchContext,
    editBuffer: {
      dirtyFramesRef: dirtyRotoFramesRef, markDirty: rotoEditBuffer.markDirty,
      undoOverlay: rotoEditBuffer.undoOverlay, redoOverlay: rotoEditBuffer.redoOverlay, clearCachedOverlay: rotoEditBuffer.clearCachedOverlay,
      clearFrame: rotoEditBuffer.clearFrame, snapshotFrame: rotoEditBuffer.snapshotFrame,
    },
    session: { markLiveOverlayDirty: rotoSession.markLiveOverlayDirty, markLiveOverlayEmpty: rotoSession.markLiveOverlayEmpty },
    reference: {
      cachedReferenceUrl: cachedRotoReferenceUrl, cachedRepaintBaseFrame: cachedRotoRepaintBaseFrame,
      clearReference: clearCachedRotoReferenceUrl, resetReference: resetCachedRotoReference, setReferenceUrl: setCachedRotoReferenceUrl,
      loadReferenceFrame: loadCachedRotoReferenceFrame,
    },
    clearCachedFrame: rotoPersistence.clearCurrentFrame,
    playback: { stop: rotoCachedPlayback.stop }, syncPendingFrames: syncPendingRotoFrames,
    status: { setApplyStatus, setApplyMessage },
    isMutationLocked: () => rotoScript.mutationLocked.peek(),
  });
  const undo = useCallback(() => {
    const changed = rotoFrameEditing.undo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoFrameEditing, rotoScript]);
  const redo = useCallback(() => {
    const changed = rotoFrameEditing.redo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoFrameEditing, rotoScript]);
  const beginRotoFrameEdit = rotoFrameEditing.beginFrameEdit;
  acceptRotoScriptBrushRef.current = rotoFrameEditing.acceptScriptBrush;
  useRotoBackgroundMetadataSync({ launchContext, workflowMode, settings });
  const getRotoCachedPlaybackFrames = () => rotoSession.playbackFrameNumbers.value.map((appFrame) => ({ appFrame, frame: findCachedRotoDisplayFrame(appFrame) }));
  const missingConditions = selectPhysicsPaintMissingConditions({
    engineReady: Boolean(engine),
    canvasMounted,
    hasLaunchContext: Boolean(launchContext),
    bridgeMode,
    applyStatus,
    isPlaying,
    rotoPlaybackActive: rotoCachedPlayback.isActive,
  });
  const readyToApply = missingConditions.length === 0;
  const playCoordinator = usePhysicsPaintPlayCoordinator<RenderedFramePayload>({
    engine, launchContext, setLaunchContext, currentFrame, workflowMode, previewFps, framesToApply, setFramesToApply,
    settings, playWiggle, setPlayWiggle, readyToApply, bridgeMode,
    getStoredFrame: (layerId, appFrame) => physicPaintStore.getFrame(layerId, appFrame),
    stopRotoPlayback: rotoCachedPlayback.stop, setIsPlaying, setAnimFrame, setAnimTotal,
    setApplyStatus, setApplyMessage, setLastError, showLimit: playLimitToast.show,
    applyLifecycle: {
      setActiveOperationId: (operationId) => { activeOperationIdRef.current = operationId; },
      clearPendingApply: () => { pendingApplyRef.current = null; },
      registerPendingApply, startApplyTimeout,
    },
    sendApplyPayload: sendPhysicPaintApplyPayload,
  });
  const {
    latestFrames: latestPlayFrames, latestFramesRef: latestPlayFramesRef, localPreviewFrame: localPlayPreviewFrame,
    localPreviewFrameRef, cachedPreviewUrl: cachedPlayPreviewUrl, cacheDirty: savedPlayCacheDirty,
    setLatestFrames: setLatestPlayFrames, setLocalPreviewFrame: setLocalPlayPreviewFrame,
    setCachedPreviewUrl: setCachedPlayPreviewUrl, setCacheDirty: setSavedPlayCacheDirty,
    bumpFramesVersion: bumpPlayFramesVersion, getCachedFramesForRange: getCachedPlayFramesForRange,
    markSelectedCacheDirty: markSelectedPlayCacheDirty, capturePendingFrameEdits: capturePendingPlayFrameEdits,
    beginFrameEdit: beginPlayFrameEdit, previewLocalFrame: previewLocalPlayFrame, annotateState: annotatePlayState,
    resetFrameEdits: resetPlayFrameEdits, restoreFrameEdits: restorePlayFrameEdits, preview: playPreview,
    stopPreview, updateFrameCount: updatePlayFrameCount, updateWiggle: updatePlayWiggle,
    updateSelectedOptions: updateSelectedPlayOptions, savePlay, currentCacheStatus: currentPlayCacheStatus,
    missingConversionFrames: missingPlayFramesForConversion,
  } = playCoordinator;
  const removeCachedRotoFrameFromLaunchContext = rotoPersistence.removeCachedFrame;
  const clearActiveSource = useCallback(() => {
    if (rotoScript.mutationLocked.peek() || !engine || !launchContext) return;
    if (workflowMode === 'roto') {
      if (rotoFrameEditing.clearCurrentFrame()) rotoScript.notifySourceRevision();
      return;
    }
    engine.clear();
    latestPlayFramesRef.current = [];
    setLatestPlayFrames([]);
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setApplyStatus('success');
    setApplyMessage(`Cleared Play canvas range ${currentFrame}–${currentFrame + clampPhysicPaintFrameCount(framesToApply) - 1}.`);
  }, [currentFrame, engine, framesToApply, launchContext, markSelectedPlayCacheDirty, rotoFrameEditing, rotoScript, workflowMode]);
  const dryPaint = useCallback(() => {
    if (rotoScript.mutationLocked.peek()) return;
    engine?.forceDry();
  }, [engine, rotoScript]);
  useRotoPersistenceIntegration({
    action: { bridgeMode, registerPendingApply, startApplyTimeout },
    frame: { current: currentFrame, source: currentFrameOwnerSourceFrame ?? currentFrame, setLaunchContext },
    engine,
    launchContext,
    flushFramePublication: rotoPersistence.flushLivePixels,
    reference: { setUrl: setCachedRotoReferenceUrl, loadFrame: loadCachedRotoReferenceFrame },
    cache: { confirmedFramesRef: confirmedCachedRotoFramesRef, latestFramesRef: latestRotoFramesRef, removeFrame: removeCachedRotoFrameFromLaunchContext },
    lifecycle: { activeOperationIdRef, pendingFrameSyncRef, pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef },
    navigation: rotoNavigation,
    status: { setApplyStatus, setApplyMessage },
  });
  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    workflowMode, localPreviewFrameRef, engineRef,
    lifecycle: {
      pendingFrameSyncRef,
      pendingApplyRef,
      activeOperationIdRef,
      prepareScriptLaunchReplacement: rotoScript.prepareLaunchReplacement,
      completeScriptLaunchReplacement: rotoScript.completeLaunchReplacement,
    },
    state: {
      setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty,
      setPlayWiggle, setSettings, setApplyStatus, setApplyMessage, setLastError,
    },
    resetPersistenceForLaunch: rotoPersistence.resetForLaunch,
    resetNavigationForLaunchRef: resetRotoNavigationForLaunchRef,
    resetCachedReference: resetCachedRotoReference,
    loadCachedReferenceFrame: (frame, readyEngine) => { loadCachedRotoReferenceFrame(frame, readyEngine ?? null); },
  });
  const { saveEditableState, loadEditableState, exportDebugProof, convertPlayToRoto, convertRotoToPlay } = usePhysicsPaintWorkflowIntegration({
    session: {
      engine, workflowMode, framesToApply, canvasSize: { width: canvasWidth, height: canvasHeight }, launchContext, currentFrame, previewFps,
      capturePendingPlayFrameEdits, annotatePlayState, restorePlayFrameEdits,
      clearLatestPlayFrames: () => setLatestPlayFrames([]), setCachedPlayPreviewUrl, setSavedPlayCacheDirty,
      setLocalPlayPreviewFrame, setFramesToApply, bumpPlayFramesVersion, setLaunchContext, setApplyStatus, setApplyMessage, setLastError,
      isMutationLocked: () => rotoScript.mutationLocked.peek(),
    },
    conversion: {
      getActionContext: () => actionContext, getCurrentFrame: () => currentFrame, getRequestedFrameCount: () => framesToApply,
      getLatestPlayFrames: () => latestPlayFramesRef.current, getPlayWiggle: () => playWiggle,
      getRenderOptions: () => buildPlayRenderOptionsSnapshot(settings, playWiggle), registerPendingApply, startApplyTimeout,
      clearActiveApply, sendApplyPayload: sendPhysicPaintApplyPayload,
      getCachedRotoFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId),
      setFrame: (layerId, frame, renderedFrame) => physicPaintStore.setFrame(layerId, frame, renderedFrame),
      setEditableState: (layerId, state) => physicPaintStore.setEditableState(layerId, state),
      removeFrameRange: (layerId, startFrame, frameCount) => physicPaintStore.removeFrameRange(layerId, startFrame, frameCount),
      resetLatestPlayFrames: () => { latestPlayFramesRef.current = []; setLatestPlayFrames([]); },
      resetPlayPreview: () => setCachedPlayPreviewUrl(null), markPlayCacheDirty: () => setSavedPlayCacheDirty(true),
      resetPlayFrameEdits, setLaunchContext, setWorkflowMode, setApplyStatus, setApplyMessage, setLastError,
    },
  });
  usePhysicsPaintApplyResultController({
    bridgeMode,
    canvasSize: { width: canvasWidth, height: canvasHeight },
    general: { matchApplyResult, pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, setApplyStatus, setApplyMessage, setLastError },
  });
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: { currentFrame, framesToApply, isPlaying, savedPlayCacheDirty, workflowMode, mutationLocked },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
      stopPreview,
      savePlay: () => { void savePlay(); },
      toggleShortcuts: () => setShortcutsVisible((visible) => !visible),
      toggleRotoPlayback: rotoCachedPlayback.toggle,
      navigateRotoFrame: (frame) => { void requestRotoFrameNavigation(frame); },
      toggleOnion: () => setOnion((current) => ({ ...current, enabled: !current.enabled })),
      adjustOnionCount: (delta) => setOnion((current) => ({ ...current, count: clampOnionCount(current.count + delta) })),
      findCachedPlayFrames: getCachedPlayFramesForRange,
      playPreview,
    },
  });
  const onionPreviewFrames = projectRotoOnionPreviewFrames({
    currentFrame,
    currentFrameOwnerSourceFrame,
    isPlaying,
    onion,
    launchFrames: latestRotoFramesRef.current,
    storeFrames: launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : [],
    previewFrames: rotoPreviewFramesRef.current,
    dirtyFrames: dirtyRotoFramesRef.current,
  });
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: getRotoCachedPlaybackFrames(),
  });
  const { updateRotoInterpolationSettings } = useRotoInterpolationController({
    launchContext, getLatestFrames: () => latestRotoFramesRef.current, currentFrame, bridgeMode,
    updateSettings: (frame, patch) => rotoTimelineActions.updateInterpolationSettings(frame, patch),
    getStoreFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId), seedStore: physicPaintStore,
    setEditableFrames: rotoEditBuffer.setEditableFrameList,
    replaceConfirmedFrames: (frames) => { confirmedCachedRotoFramesRef.current = frames; },
    setLaunchContext, sendFrameSync: sendPhysicPaintFrameSyncMessage, sendApplyPayload: sendPhysicPaintApplyPayload,
    setApplyStatus, setApplyMessage, setLastError, setPlaybackStatus: rotoCachedPlayback.setStatus,
    isMutationLocked: () => rotoScript.mutationLocked.peek(),
  });
  const rotoNavigationActions = rotoNavigation.createNavigationActions({
    currentFrame,
    framesToApply,
    savedFrames: timelineSavedRotoFrames,
    playFrames: latestPlayFrames,
  });
  const { goToFirstFrame, goToPreviousFrame, goToNextFrame, goToLastFrame } = rotoNavigationActions;
  const rotoMotion = launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : null;
  const panelMotion = workflowMode === 'roto' && rotoMotion
    ? { strokeDeformation: rotoMotion.deform, strokePosition: rotoMotion.position }
    : playWiggle;
  const updatePanelMotion = workflowMode === 'roto'
    ? (motion: AnimationWiggleConfig) => { void updateRotoInterpolationSettings({ deform: motion.strokeDeformation, position: motion.strokePosition }); }
    : updatePlayWiggle;
  const viewModel = usePhysicsPaintStudioViewModel({
    layout: {
        rightPanelCollapsed,
        onKeyDown: handlePhysicsPaintKeyDown,
        onSetRightPanelCollapsed: setRightPanelCollapsed,
      },
    topBar: {
        brushSize: settings.size, opacity: settings.opacity, background: settings.background, paperGrain: settings.paperGrain, grainStrength: settings.grainStrength, ready: readyToApply, disabled: mutationLocked,
        onBrushSizeChange: setBrushSize, onOpacityChange: setBrushOpacity, onBackgroundChange: setBackground, onPaperGrainChange: setPaperGrain, onGrainStrengthChange: setGrainStrength,
      },
    toolRail: {
        activeTool: settings.tool, physicsMode: settings.physicsMode, activePhysicsAction: settings.activePhysicsAction,
        historyAvailability, disabled: !engine || mutationLocked,
        onSelectTool: selectTool, onUndo: undo, onRedo: redo, onClearFrame: clearActiveSource, onPhysicsStart: startPhysics, onPhysicsStop: stopPhysics, onDryPaint: dryPaint,
      },
    canvas: {
        toastMessage: playLimitToast.message, onDismissToast: playLimitToast.dismiss, cachedPlayPreviewUrl, cachedRotoReferenceUrl,
        cachedRotoPlaybackUrl: rotoCachedPlayback.frame?.dataUrl ?? null,
        cachedRotoPlaybackActive: rotoCachedPlayback.isActive,
        cachedRotoPlaybackComposition: launchContext?.rotoBackground ? { width: projectCanvasWidth, height: projectCanvasHeight, background: launchContext.rotoBackground } : null,
        inputDisabled: rotoInputDisabled,
        inputDisabledMessage: currentFrameIsGeneratedRoto
          ? `Generated frame ${currentFrame} is render-only.`
          : mutationLocked
            ? 'Finish the current Roto script operation.'
            : undefined,
        onInputIntent: workflowMode === 'play' ? beginPlayFrameEdit : beginRotoFrameEdit,
        onionOverlay: onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
          <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={frame.dataUrl} style={{ opacity: getOnionFrameOpacity(frame.distance, onion.opacity) }} alt="" />
        )) : null,
        canvasKey,
        mount: {
          width: canvasWidth, height: canvasHeight, paperTextureScale,
          onEngineReady: (readyEngine) => {
            readyEngine.setHistoryAvailabilityListener((availability) => {
              historyAvailability.value = availability;
              rotoScript.notifySourceRevision();
            });
            handleEngineReady(readyEngine);
            rotoScript.updateEngine(readyEngine);
            if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine);
          },
          onCanvasMounted: setCanvasMounted,
          onNativePenInputReady: handleNativePenInputReady,
          onPerformanceSample: recordEnginePerformance,
          beforeEngineDestroy: rotoScript.prepareEngineDisposal,
          onCompletedMutation: (mutation, mutationEngine) => {
            rotoScript.observeCompletedMutation(mutationEngine, mutation);
            const { kind, isEmpty, mutationId } = mutation;
            const acceptedTarget = rotoScript.getAcceptedTarget(mutationEngine, mutationId);
            const publicationIdentity = acceptedTarget?.publicationIdentity;
            const canPublishCapturedApply = Boolean(publicationIdentity);
            const canPublishCurrentEngine = mutationEngine === engineRef.current
              && workflowMode === 'roto'
              && currentFrameSelectionKind !== 'generated-interpolation'
              && Boolean(launchContext);
            if (kind === 'clear' || (!canPublishCapturedApply && !canPublishCurrentEngine) || !launchContext) return;
            if (acceptedTarget && !acceptedTarget.publishPixels) return;
            const emptyTarget = !acceptedTarget && currentFrameSelectionKind === 'empty'
              ? claimRotoSelectedFrame({
                model: rotoTimelineModel.view.value.model,
                selectedFrame: currentFrame,
                currentSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
              })
              : null;
            const sourceFrame = acceptedTarget?.sourceFrame
              ?? emptyTarget?.sourceFrame
              ?? resolveRotoSourceFrameForDisplayFrame(currentFrame);
            const displayFrame = acceptedTarget?.displayFrame ?? emptyTarget?.displayFrame ?? currentFrame;
            const cachedBaseSourceFrame = cachedRotoRepaintBaseFrame
              ? cachedRotoRepaintBaseFrame.sourceFrame ?? cachedRotoRepaintBaseFrame.appFrame
              : null;
            if (isEmpty) {
              if (cachedRotoRepaintBaseFrame && cachedBaseSourceFrame === sourceFrame) {
                rotoPersistence.invalidateLivePixels(sourceFrame);
                rotoPersistence.upsertCachedFrame(cachedRotoRepaintBaseFrame, false);
              } else {
                rotoPersistence.removeCachedFrame(sourceFrame);
              }
              return;
            }
            const snapshotStartedAt = profilePerformance ? performance.now() : 0;
            const liveAlphaCanvas = mutationEngine.copyLiveAlphaCanvas();
            const capturedBase = publicationIdentity?.cachedBase ?? null;
            const capturedBaseSourceFrame = capturedBase?.sourceFrame ?? capturedBase?.appFrame ?? null;
            const cachedBase = publicationIdentity
              ? capturedBaseSourceFrame === sourceFrame ? capturedBase : null
              : cachedBaseSourceFrame === sourceFrame ? cachedRotoRepaintBaseFrame : null;
            const capture = rotoPersistence.captureLivePixels({
              layerId: publicationIdentity?.layerId ?? launchContext.layerId,
              operationId: publicationIdentity?.operationId,
              sourceFrame,
              displayFrame,
              liveAlphaCanvas,
              cachedBase,
              background: publicationIdentity?.background,
              size: { width: canvasWidth, height: canvasHeight },
              mutationId,
              interpolationSettings: acceptedTarget?.interpolationSettings ?? emptyTarget?.interpolationSettings,
            });
            if (profilePerformance) recordPhysicsPaintPerformance({ stage: 'snapshot-handoff', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAt, timestamp: performance.now(), mutationId, sourceFrame });
            void capture.catch((error) => {
              console.error('[PhysicsPaintStudio] Automatic Roto pixel cache failed', error);
            });
          },
          getStrokeMetadata,
        },
      },
    rightPanel: {
        activeTool: settings.tool, color: settings.color, opacity: settings.opacity, edgeDetail: settings.edgeDetail, pickup: settings.pickup, spread: settings.spread, smoothing: settings.smoothing, eraseStrength: settings.eraseStrength, physicsMode: settings.physicsMode,
        onion, onionDisabled: isPlaying, engineControlsDisabled: mutationLocked, playWiggle: panelMotion, devExportEnabled: isPhysicsPaintDevExportEnabled(import.meta.env), devExportBusy: applyStatus === 'applying', applyStatus, applyMessage, error: lastError,
        onExportDebugProof: exportDebugProof, onColorChange: setBrushColor, onEdgeDetailChange: setEdgeDetail, onPickupChange: setPickup, onSpreadChange: setSpread, onSmoothingChange: setSmoothing, onEraseStrengthChange: setEraseStrength,
        onOnionChange: setOnion, onPlayWiggleChange: updatePanelMotion, onSaveState: saveEditableState, onLoadState: loadEditableState,
      },
    workflow: {
        mode: workflowMode, currentFrame, startFrame: launchContext?.startFrame ?? 0, frameCount: framesToApply, currentPreviewFrame: localPlayPreviewFrame, maxPlayFrameCount: launchContext?.maxPlayFrameCount, maxPlayFrameCountReason: launchContext?.maxPlayFrameCountReason,
        playCacheStatus: currentPlayCacheStatus, onPlayLimit: playLimitToast.show, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames,
        keyActionInFlight: rotoKeyUtilities.keyActionInFlight || rotoScriptNavigationLocked, mutationLocked, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: rotoCachedPlayback.setLoop, onRotoPlaybackFpsChange: rotoCachedPlayback.updateFps, rotoInterpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
        onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled }), onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount }),
        onDuplicateRotoKey: duplicateRotoKey, onInsertRotoFrame: insertRotoFrame, onDeleteRotoFrame: deleteRotoFrame, onCopyRotoFrame: copyRotoFrame, onPasteRotoFrame: pasteRotoFrame, hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        rotoScript, onCopyRotoScript: () => { void rotoScript.copyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onApplyRotoScript: () => { void rotoScript.applyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onDiscardRotoScript: () => { rotoScript.discardScript(); setLastError(null); },
        playPublicationSummary: applyStatus === 'success' ? applyMessage : null, statusMessage: isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying, missingPlayFramesForConversion,
        onSavePlay: savePlay, onUpdatePlayOptions: updateSelectedPlayOptions, onFrameCountChange: updatePlayFrameCount, onPlayPreview: playPreview, onStopPreview: stopPreview, onPreviewPlayFrame: previewLocalPlayFrame,
        onNavigateToSyncedFrame: (frame) => { void requestRotoFrameNavigation(frame); }, onGoToFirstFrame: goToFirstFrame, onGoToPreviousFrame: goToPreviousFrame, onGoToNextFrame: goToNextFrame, onGoToLastFrame: goToLastFrame, onInspectPlayFrame: previewLocalPlayFrame, onOnionChange: setOnion, onConvertPlayToRoto: convertPlayToRoto, onConvertRotoToPlay: convertRotoToPlay,
      },
    status: { shortcutsVisible },
  });
  return <PhysicsPaintStudioView {...viewModel} />;
}
