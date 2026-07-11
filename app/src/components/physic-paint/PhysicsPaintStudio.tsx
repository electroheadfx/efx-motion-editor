import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, type PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { physicPaintStore } from '../../stores/physicPaintStore';
import { clampOnionCount, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './view/physicsPaintWorkflowPresentation';
import { getPreviewFps } from './play/physicsPaintPlayWorkflow';
import { getSourceRotoFrameForDisplayFrame } from './roto/physicsPaintRotoWorkflow';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectRealCachedRotoFrames, selectRealCachedRotoSourceFrameNumbers } from './roto/rotoTimelineSelectors';
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
import { buildPlayRenderOptionsSnapshot, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './engine/physicsPaintStudioSettings';
import { getLaunchWorkflowMode, parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from './bridge/physicsPaintBridgeTransport';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { usePhysicsPaintBridgeMode, type PhysicsPaintBridgeMode } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoInterpolationController } from './hooks/useRotoInterpolationController';
import './physicsPaintStudio.css';
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
const DEFAULT_ONION_STATE: PhysicsPaintOnionState = { enabled: false, previous: true, next: false, count: 1, opacity: 50 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };
interface PhysicsPaintActionContext { engine: EfxPaintEngine; launchContext: PhysicPaintLaunchContext; bridgeMode: PhysicsPaintBridgeMode }
export function PhysicsPaintStudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [animTotal, setAnimTotal] = useState(0);
  const [launchContext, setLaunchContext] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const bridgeMode = usePhysicsPaintBridgeMode();
  const [lastError, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [framesToApply, setFramesToApply] = useState(() => clampPhysicPaintFrameCount(launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialPhysicsPaintStudioSettings());
  const [workflowMode, setWorkflowMode] = useState<PhysicsPaintWorkflowMode>(() => getLaunchWorkflowMode(launchContext));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [onion, setOnion] = useState<PhysicsPaintOnionState>(DEFAULT_ONION_STATE);
  const [playWiggle, setPlayWiggle] = useState<AnimationWiggleConfig>(() => normalizePlayWiggle(launchContext?.playMotion ?? DEFAULT_PLAY_WIGGLE));
  const resetRotoKeySessionRef = useRef<() => void>(() => {});
  const rotoPersistence = useRotoFramePersistenceCoordinator({
    workflowMode,
    backgroundMode: settings.background,
    launchContext,
    setLaunchContext,
    store: {
      getRotoFrame: (layerId, frame) => physicPaintStore.getRotoFrame(layerId, frame),
      getFrame: (layerId, frame) => physicPaintStore.getFrame(layerId, frame),
      upsertRealKey: (layerId, frame, renderedFrame, backgroundOnly) => physicPaintStore.upsertRealRotoKeyFrame(layerId, frame, renderedFrame, backgroundOnly),
      getCacheFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId),
      getInterpolationSettings: (layerId) => physicPaintStore.getRotoInterpolationSettings(layerId),
      setInterpolationSettings: (layerId, interpolationSettings) => physicPaintStore.setRotoInterpolationSettings(layerId, interpolationSettings),
    },
    syncPending: () => resetRotoKeySessionRef.current(),
    setApplyMessage,
  });
  const rotoEditBuffer = rotoPersistence.editBuffer;
  const editableRotoFrames = rotoEditBuffer.editableFrames;
  const rotoFrameStatesRef = { get current() { return rotoEditBuffer.bufferRef.current.frameStates; }, set current(states) { rotoEditBuffer.replaceFrameStates(states); } };
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const rotoCapturedFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.capturedFrames; } };
  const liveRotoOverlayActionCountRef = { get current() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null);
  const playLimitToast = usePlayLimitToast();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const confirmedCachedRotoFramesRef = rotoPersistence.confirmedFramesRef;
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const closeGuardBypassRef = useRef(false);
  const saveOnLeaveRenderedFrameRef = useRef<{ renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const pendingCachedRotoMergeFrameRef = useRef<{ frame: number; renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const pendingFrameSyncRef = useRef<number | null>(null);
  const saveOnLeaveDeleteFrameRef = useRef<number | null>(null);
  const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null);
  const resetRotoNavigationForLaunchRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current();
  }, []);
  const { activeOperationIdRef, pendingApplyRef, closeAfterApplyOperationIdRef, closeAfterRotoSaveRequestedRef, pendingRotoAdvanceRef, saveOnLeaveSourceFrameRef, registerPendingApply, clearActiveApply, matchApplyResult, startApplyTimeout } = useRotoApplyLifecycle({
    onTimeout: (transition) => {
      setApplyStatus('error');
      setApplyMessage(transition.message);
      setLastError(transition.message);
      if (transition.saveOnLeaveSourceFrame !== null) {
        dirtyRotoFramesRef.current.add(transition.saveOnLeaveSourceFrame);
        syncPendingRotoFrames();
      }
      saveOnLeaveRenderedFrameRef.current = null;
      pendingCachedRotoMergeFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      setRotoSavingFrame(null);
      if (transition.closeFailed) {
        setRotoClosePromptState('error');
        setRotoClosePromptMessage(transition.closeMessage);
        closeAfterApplyOperationIdRef.current = null;
      }
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
      pendingRotoAdvanceRef.current = null;
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingCachedRotoMergeFrameRef.current = null;
    },
  });
  const currentFrame = launchContext?.startFrame ?? 0;
  const previewFps = getPreviewFps(launchContext?.fps);
  const actionContext = useMemo<PhysicsPaintActionContext | null>(() => {
    if (!engine || !launchContext) return null;
    return { engine, launchContext, bridgeMode };
  }, [bridgeMode, engine, launchContext]);
  const resolveRotoSourceFrameForDisplayFrame = useCallback((displayFrame: number) => {
    if (!launchContext) return displayFrame;
    return getSourceRotoFrameForDisplayFrame(
      displayFrame,
      selectRealCachedRotoSourceFrameNumbers(launchContext?.cachedRotoFrames),
      physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    ) ?? displayFrame;
  }, [launchContext]);
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    interpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
    currentFrame,
  });
  const rotoTimelineActions = useRotoTimelineActions({
    getModel: () => rotoTimelineModel.view.value.model,
    getStoreRealKeyFrames: () => launchContext ? selectRealCachedRotoSourceFrameNumbers(launchContext.cachedRotoFrames) : [],
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
  const currentFrameIsGeneratedRoto = workflowMode === 'roto' && rotoTimelineModel.currentFrameIsGenerated.value;
  const rotoInputDisabled = workflowMode === 'roto' && ((Boolean(saveOnLeaveSourceFrameRef.current) && applyStatus === 'applying') || currentFrameIsGeneratedRoto);
  const { cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, setCachedRotoReferenceUrl, setCachedRotoRepaintBaseFrame, clearCachedRotoReferenceUrl, resetCachedRotoReference, findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame } = rotoPersistence.reference;
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
  } = usePhysicsPaintEngineActions({ engine, settings, setSettings });
  const rotoNavigation = useRotoNavigationCoordinator<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>({
    workflowMode,
    keyUtilities: {
      currentFrame,
      realKeyFrames: selectRealCachedRotoFrames(launchContext?.cachedRotoFrames),
      cachedRotoFrames: launchContext?.cachedRotoFrames,
      dirtyFrames: dirtyRotoFramesRef.current,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      applyStatus,
      flushInFlight: Boolean(rotoFlushInFlightRef.current),
      buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
      resolveSourceFrameForDisplayFrame: resolveRotoSourceFrameForDisplayFrame,
      resolvePasteTargetForDisplayFrame: (displayFrame) => launchContext ? rotoTimelineActions.saveRealKeyAtDisplayFrame(displayFrame).target : null,
      segmentSpacingOverrides: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).segmentSpacingOverrides : undefined,
      getEditableStates: () => rotoFrameStatesRef.current,
      setEditableStates: (states) => { rotoFrameStatesRef.current = states; },
      getPreviewFrames: () => rotoPreviewFramesRef.current,
      setPreviewFrames: (frames) => { rotoPreviewFramesRef.current = frames as Map<number, RenderedFramePayload>; },
      getEditableState: (frame) => rotoFrameStatesRef.current.get(frame) ?? null,
      setDirtyFrames: (frames) => { dirtyRotoFramesRef.current = frames; },
      syncPendingRotoFrames,
      showCachedReference: (frame) => setCachedRotoReferenceUrl(frame.dataUrl),
      clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, frame, 1); },
      clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, frame); },
      snapshotCurrentRotoFrame: () => { snapshotCurrentRotoFrame(); },
      setApplyMessage,
      setApplyStatus,
      setLastError,
      setRotoSavingFrame,
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
  const executeRotoSessionEffects = rotoKeyUtilities.executeSessionEffects;
  const duplicateRotoKey = rotoKeyUtilities.duplicateKey;
  const insertRotoFrame = rotoKeyUtilities.insertBlankKey;
  const deleteRotoFrame = rotoKeyUtilities.deleteKey;
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;
  const rotoCachedPlayback = rotoNavigation.playback;
  resetRotoKeySessionRef.current = rotoKeyUtilities.resetSession;
  resetRotoNavigationForLaunchRef.current = rotoNavigation.resetForLaunch;
  const rotoFrameEditing = useRotoFrameEditingController({
    workflowMode, currentFrame, currentFrameIsGenerated: currentFrameIsGeneratedRoto,
    canvasSize: { width: canvasWidth, height: canvasHeight }, engine, launchContext,
    editBuffer: {
      dirtyFramesRef: dirtyRotoFramesRef, markDirty: rotoEditBuffer.markDirty,
      undoOverlay: rotoEditBuffer.undoOverlay, clearCachedOverlay: rotoEditBuffer.clearCachedOverlay,
      clearFrame: rotoEditBuffer.clearFrame, snapshotFrame: rotoEditBuffer.snapshotFrame,
    },
    session: { markLiveOverlayDirty: rotoSession.markLiveOverlayDirty, markLiveOverlayEmpty: rotoSession.markLiveOverlayEmpty },
    reference: {
      cachedReferenceUrl: cachedRotoReferenceUrl, cachedRepaintBaseFrame: cachedRotoRepaintBaseFrame,
      clearReference: clearCachedRotoReferenceUrl, setReferenceUrl: setCachedRotoReferenceUrl,
      loadReferenceFrame: loadCachedRotoReferenceFrame,
    },
    playback: { stop: rotoCachedPlayback.stop }, syncPendingFrames: syncPendingRotoFrames,
    status: { setApplyStatus, setApplyMessage },
  });
  const { undo, beginFrameEdit: beginRotoFrameEdit, snapshotCurrentFrame: snapshotCurrentRotoFrame } = rotoFrameEditing;
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
  const addEditableRotoFrame = rotoEditBuffer.addEditableFrame;
  const removeEditableRotoFrame = rotoEditBuffer.removeEditableFrame;
  const upsertCachedRotoFrameInLaunchContext = rotoPersistence.upsertCachedFrame;
  const removeCachedRotoFrameFromLaunchContext = rotoPersistence.removeCachedFrame;
  const clearActiveSource = useCallback(() => {
    if (!engine || !launchContext) return;
    engine.clear();
    if (rotoFrameEditing.clearCurrentFrame()) return;
    latestPlayFramesRef.current = [];
    setLatestPlayFrames([]);
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setApplyStatus('success');
    setApplyMessage(`Cleared Play canvas range ${currentFrame}–${currentFrame + clampPhysicPaintFrameCount(framesToApply) - 1}.`);
  }, [cachedRotoRepaintBaseFrame, currentFrame, engine, framesToApply, launchContext, markSelectedPlayCacheDirty, removeEditableRotoFrame, rotoSession, syncPendingRotoFrames, workflowMode]);
  const dryPaint = useCallback(() => {
    engine?.forceDry();
  }, [engine]);
  const rotoPersistenceIntegration = useRotoPersistenceIntegration({
    action: {
      getContext: () => actionContext, bridgeMode, readyToApply,
      registerPendingApply, startApplyTimeout,
    },
    frame: {
      current: currentFrame, generated: currentFrameIsGeneratedRoto,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      resolveSource: resolveRotoSourceFrameForDisplayFrame,
      snapshotCurrent: snapshotCurrentRotoFrame, setLaunchContext,
    },
    engine, launchContext, settings, workflowMode,
    editBuffer: {
      frameStatesRef: rotoFrameStatesRef, previewFramesRef: rotoPreviewFramesRef,
      capturedFramesRef: rotoCapturedFramesRef, dirtyFramesRef: dirtyRotoFramesRef,
      addEditableFrame: addEditableRotoFrame, removeEditableFrame: removeEditableRotoFrame,
    },
    reference: {
      cachedRepaintBaseFrame: cachedRotoRepaintBaseFrame, setUrl: setCachedRotoReferenceUrl,
      clearUrl: clearCachedRotoReferenceUrl, setRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
      loadFrame: loadCachedRotoReferenceFrame,
    },
    cache: {
      confirmedFramesRef: confirmedCachedRotoFramesRef,
      upsertFrame: upsertCachedRotoFrameInLaunchContext,
      removeFrame: removeCachedRotoFrameFromLaunchContext,
      saveRealKeyAtDisplayFrame: rotoTimelineActions.saveRealKeyAtDisplayFrame,
    },
    session: { savingFrame: rotoSession.savingFrame, requestFrame: rotoSession.requestFrame },
    lifecycle: {
      activeOperationIdRef, pendingAdvanceRef: pendingRotoAdvanceRef, pendingFrameSyncRef,
      saveOnLeaveSourceFrameRef, saveOnLeaveRenderedFrameRef,
      pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
      saveOnLeaveDeleteFrameRef, flushInFlightRef: rotoFlushInFlightRef,
      closeGuardBypassRef, closeAfterApplyOperationIdRef, closeAfterRotoSaveRequestedRef,
      pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef,
    },
    navigation: rotoNavigation,
    status: { applyStatus, setApplyStatus, setApplyMessage, setLastError, setSavingFrame: setRotoSavingFrame },
    syncPendingFrames: syncPendingRotoFrames,
  });
  const {
    saveRotoFrame, savePendingRotoFrames, openAfterSave: openSyncedRotoFrameAfterSave,
    rotoClosePromptState, rotoClosePromptMessage, setRotoClosePromptState,
    setRotoClosePromptMessage, closePhysicsPaintWindow, closeWithoutSavingRotoFrame,
    cancelRotoClose, saveAndCloseRotoFrame,
  } = rotoPersistenceIntegration;
  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    workflowMode, localPreviewFrameRef, engineRef,
    lifecycle: {
      pendingAdvanceRef: pendingRotoAdvanceRef, pendingFrameSyncRef, saveOnLeaveSourceFrameRef, saveOnLeaveRenderedFrameRef,
      pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef, saveOnLeaveDeleteFrameRef, pendingApplyRef,
      activeOperationIdRef, closeAfterApplyOperationIdRef, closeAfterRotoSaveRequestedRef, closeGuardBypassRef,
      flushInFlightRef: rotoFlushInFlightRef,
    },
    state: {
      setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty,
      setPlayWiggle, setSettings, setApplyStatus, setApplyMessage, setLastError, setRotoSavingFrame,
      setClosePromptState: setRotoClosePromptState, setClosePromptMessage: setRotoClosePromptMessage,
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
    bridgeMode, canvasSize: { width: canvasWidth, height: canvasHeight },
    roto: {
      pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, pendingAdvanceRef: pendingRotoAdvanceRef,
      saveOnLeaveSourceFrameRef, saveOnLeaveRenderedFrameRef, pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
      saveOnLeaveDeleteFrameRef, dirtyFramesRef: dirtyRotoFramesRef, capturedFramesRef: rotoCapturedFramesRef,
      frameStatesRef: rotoFrameStatesRef, liveOverlayActionCountsRef: liveRotoOverlayActionCountRef,
      closeAfterApplyOperationIdRef, closeAfterRotoSaveRequestedRef, closeGuardBypassRef,
      getSessionSavingFrame: () => rotoSession.savingFrame.value, onSessionSaveFailed: rotoSession.onSaveFailed,
      onSessionSaveSucceeded: rotoSession.onSaveSucceeded, getSessionDirtyFrames: () => rotoSession.dirtyFrames.value,
      executeSessionEffects: executeRotoSessionEffects, syncPendingFrames: syncPendingRotoFrames,
      upsertCachedFrame: (save) => upsertCachedRotoFrameInLaunchContext(save.renderedFrame, save.backgroundOnly, save.onionFrame),
      removeCachedFrame: removeCachedRotoFrameFromLaunchContext, removeEditableFrame: removeEditableRotoFrame,
      setCachedReferenceUrl: setCachedRotoReferenceUrl, setCachedRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
      getEngine: () => engine, getCurrentFrame: () => currentFrame, getBackgroundMode: () => settings.background,
      restorePreviewBase: (saveEngine, dataUrl) => { (saveEngine as PreviewBackgroundEngine).setPreviewBaseImageUrl(dataUrl); },
      openFrameAfterSave: async (frame) => { await openSyncedRotoFrameAfterSave(frame); }, closeWindow: closePhysicsPaintWindow,
      setApplyStatus, setApplyMessage, setLastError, setSavingFrame: setRotoSavingFrame,
      setClosePromptState: setRotoClosePromptState, setClosePromptMessage: setRotoClosePromptMessage,
    },
    general: {
      matchApplyResult, closeAfterApplyOperationIdRef, closeAfterRotoSaveRequestedRef,
      setApplyStatus, setApplyMessage, setLastError, setClosePromptState: setRotoClosePromptState,
      setClosePromptMessage: setRotoClosePromptMessage,
    },
  });
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: { currentFrame, framesToApply, isPlaying, savedPlayCacheDirty, workflowMode },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      stopPreview,
      savePlay: () => { void savePlay(); },
      saveRotoFrame: () => { void saveRotoFrame(null); },
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
    isPlaying,
    onion,
    launchFrames: launchContext?.cachedRotoFrames,
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
    launchContext, currentFrame, bridgeMode,
    updateSettings: (frame, patch) => rotoTimelineActions.updateInterpolationSettings(frame, patch),
    getStoreFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId), seedStore: physicPaintStore,
    setEditableFrames: rotoEditBuffer.setEditableFrameList,
    replaceConfirmedFrames: (frames) => { confirmedCachedRotoFramesRef.current = frames; },
    setLaunchContext, sendFrameSync: sendPhysicPaintFrameSyncMessage, sendApplyPayload: sendPhysicPaintApplyPayload,
    setApplyStatus, setApplyMessage, setLastError, setPlaybackStatus: rotoCachedPlayback.setStatus,
  });
  const rotoNavigationActions = rotoNavigation.createNavigationActions({
    currentFrame,
    framesToApply,
    savedFrames: timelineSavedRotoFrames,
    playFrames: latestPlayFrames,
  });
  const { goToFirstFrame, goToPreviousFrame, goToNextFrame, goToLastFrame } = rotoNavigationActions;
  const viewModel = usePhysicsPaintStudioViewModel({
    layout: {
        rightPanelCollapsed,
        onKeyDown: handlePhysicsPaintKeyDown,
        onSetRightPanelCollapsed: setRightPanelCollapsed,
      },
    topBar: {
        brushSize: settings.size, opacity: settings.opacity, background: settings.background, paperGrain: settings.paperGrain, grainStrength: settings.grainStrength, ready: readyToApply,
        onBrushSizeChange: setBrushSize, onOpacityChange: setBrushOpacity, onBackgroundChange: setBackground, onPaperGrainChange: setPaperGrain, onGrainStrengthChange: setGrainStrength,
      },
    toolRail: {
        activeTool: settings.tool, physicsMode: settings.physicsMode, activePhysicsAction: settings.activePhysicsAction, canUndo: Boolean(engine), disabled: !engine,
        onSelectTool: selectTool, onUndo: undo, onClearFrame: clearActiveSource, onPhysicsStart: startPhysics, onPhysicsStop: stopPhysics, onDryPaint: dryPaint,
      },
    canvas: {
        toastMessage: playLimitToast.message, onDismissToast: playLimitToast.dismiss, cachedPlayPreviewUrl, cachedRotoReferenceUrl,
        cachedRotoPlaybackUrl: rotoCachedPlayback.frame?.dataUrl ?? null, inputDisabled: rotoInputDisabled,
        inputDisabledMessage: currentFrameIsGeneratedRoto ? `Generated frame ${currentFrame} is render-only.` : 'Saving current Roto frame…',
        onInputIntent: workflowMode === 'play' ? beginPlayFrameEdit : beginRotoFrameEdit,
        onionOverlay: onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
          <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={frame.dataUrl} style={{ opacity: getOnionFrameOpacity(frame.distance) }} alt="" />
        )) : null,
        canvasKey,
        mount: {
          width: canvasWidth, height: canvasHeight, paperTextureScale,
          onEngineReady: (readyEngine) => { handleEngineReady(readyEngine); if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine); },
          onCanvasMounted: setCanvasMounted, onNativePenInputReady: handleNativePenInputReady, getStrokeMetadata,
        },
      },
    rightPanel: {
        activeTool: settings.tool, color: settings.color, opacity: settings.opacity, edgeDetail: settings.edgeDetail, pickup: settings.pickup, spread: settings.spread, smoothing: settings.smoothing, eraseStrength: settings.eraseStrength, physicsMode: settings.physicsMode,
        onion, onionDisabled: isPlaying, playWiggle, devExportEnabled: isPhysicsPaintDevExportEnabled(import.meta.env), devExportBusy: applyStatus === 'applying', applyStatus, applyMessage, error: lastError,
        onExportDebugProof: exportDebugProof, onColorChange: setBrushColor, onEdgeDetailChange: setEdgeDetail, onPickupChange: setPickup, onSpreadChange: setSpread, onSmoothingChange: setSmoothing, onEraseStrengthChange: setEraseStrength,
        onOnionChange: setOnion, onPlayWiggleChange: updatePlayWiggle, onSaveState: saveEditableState, onLoadState: loadEditableState,
      },
    workflow: {
        mode: workflowMode, currentFrame, startFrame: launchContext?.startFrame ?? 0, frameCount: framesToApply, currentPreviewFrame: localPlayPreviewFrame, maxPlayFrameCount: launchContext?.maxPlayFrameCount, maxPlayFrameCountReason: launchContext?.maxPlayFrameCountReason,
        playCacheStatus: currentPlayCacheStatus, onPlayLimit: playLimitToast.show, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames, editableRotoFrames, pendingRotoFrames: rotoSession.dirtyFrames.value,
        rotoSaveInFlight: Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying', keyActionInFlight: rotoKeyUtilities.keyActionInFlight, rotoSavingFrame, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: rotoCachedPlayback.setLoop, onRotoPlaybackFpsChange: rotoCachedPlayback.updateFps, rotoInterpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
        onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled }), onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount }),
        onDuplicateRotoKey: duplicateRotoKey, onInsertRotoFrame: insertRotoFrame, onDeleteRotoFrame: deleteRotoFrame, onCopyRotoFrame: copyRotoFrame, onPasteRotoFrame: pasteRotoFrame, hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        playPublicationSummary: applyStatus === 'success' ? applyMessage : null, statusMessage: isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying, missingPlayFramesForConversion,
        onSaveRotoFrame: () => { void saveRotoFrame(null); }, onSavePendingRotoFrames: savePendingRotoFrames, onSavePlay: savePlay, onUpdatePlayOptions: updateSelectedPlayOptions, onFrameCountChange: updatePlayFrameCount, onPlayPreview: playPreview, onStopPreview: stopPreview, onPreviewPlayFrame: previewLocalPlayFrame,
        onNavigateToSyncedFrame: (frame) => { void requestRotoFrameNavigation(frame); }, onGoToFirstFrame: goToFirstFrame, onGoToPreviousFrame: goToPreviousFrame, onGoToNextFrame: goToNextFrame, onGoToLastFrame: goToLastFrame, onInspectPlayFrame: previewLocalPlayFrame, onOnionChange: setOnion, onConvertPlayToRoto: convertPlayToRoto, onConvertRotoToPlay: convertRotoToPlay,
      },
    status: { rotoClosePromptState, rotoClosePromptMessage, shortcutsVisible },
    actions: { closeWithoutSavingRotoFrame, cancelRotoClose, saveAndCloseRotoFrame },
  });
  return <PhysicsPaintStudioView {...viewModel} />;
}
