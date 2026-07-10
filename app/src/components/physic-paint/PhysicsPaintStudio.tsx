import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { BgMode, EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, type PhysicPaintRenderedFrame, type PhysicPaintRotoCacheFrame, type PhysicPaintRotoInterpolationSettings } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT } from '../../lib/physicPaintBridge';
import { physicPaintStore, registerRotoAlphaCanvasFrame } from '../../stores/physicPaintStore';
import { clampOnionCount, getPreviewFps, getSourceRotoFrameForDisplayFrame, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';
import type { RotoKeyUtilityActiveRestore, RotoKeyUtilityTransaction } from './physicsPaintRotoKeyController';
import type { RotoSessionEffect } from './physicsPaintRotoSession';
import { mergeCachedRotoAlphaFrame } from './physicsPaintRotoAlphaMerge';
import type { PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import { PhysicsPaintStudioView } from './PhysicsPaintStudioView';
import { useRotoTimelineActions } from './useRotoTimelineActions';
import { useRotoTimelineModel } from './useRotoTimelineModel';
import { selectRealCachedRotoFrames, selectRealCachedRotoSourceFrameNumbers } from './rotoTimelineSelectors';
import { refreshRotoInterpolationCache, removeCachedRotoCacheFrame, upsertCachedRotoCacheFrame } from './rotoCacheTransactions';
import { hydrateRotoLaunchContext, seedRotoLaunchRealKeys } from './rotoLaunchHydration';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';
import { useRotoCachedPlayback } from './useRotoCachedPlayback';
import { useRotoReferenceController } from './useRotoReferenceController';
import { useRotoApplyLifecycle } from './useRotoApplyLifecycle';
import { useRotoApplyResultController } from './useRotoApplyResultController';
import { useRotoCloseLifecycle } from './useRotoCloseLifecycle';
import { useRotoSaveController } from './useRotoSaveController';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { usePlayEditCacheController } from './usePlayEditCacheController';
import { getActivePlayStartFrame, normalizePlayWiggle } from './playFrameTransactions';
import { applyRenderedPlayCache, markPlayLaunchCacheStale, normalizePlayMotionUpdate, resolvePlayFrameCountUpdate, resolvePlayOptionsUpdate } from './playLifecycleTransactions';
import { usePlayPreviewController } from './usePlayPreviewController';
import { useRotoPlayConversionController } from './useRotoPlayConversionController';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './usePhysicsPaintEngineActions';
import { usePhysicsPaintSessionController } from './usePhysicsPaintSessionController';
import { useRotoBackgroundMetadataSync } from './useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './rotoOnionPreview';
import { createRotoNavigationActions, getRotoNavigationTargets } from './rotoNavigationActions';
import { selectCurrentPlayCacheStatus, selectPhysicsPaintMissingConditions, selectPlayConversionMissingFrames, selectRotoPlaybackAvailable } from './physicsPaintStudioSelectors';
import { usePlayLimitToast } from './usePlayLimitToast';
import {
  applyPlayRenderOptionsSnapshotToSettings,
  applyRotoBackgroundMetadataToSettings,
  buildPlayRenderOptionsSnapshot,
  buildRotoBackgroundMetadata,
  makeInitialPhysicsPaintStudioSettings,
  type PhysicsPaintStudioSettings,
} from './physicsPaintStudioSettings';
import { applyPhysicsPaintLaunchContext, getLaunchWorkflowMode, parsePhysicsPaintLaunchContext } from './physicsPaintLaunchContext';
import { usePhysicsPaintApplyResultBridge, usePhysicsPaintBridgeMode, usePhysicsPaintLaunchBridge, type PhysicsPaintBridgeMode } from './usePhysicsPaintParentBridge';
import './physicsPaintStudio.css';
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
const DEFAULT_ONION_STATE: PhysicsPaintOnionState = { enabled: false, previous: true, next: false, count: 1, opacity: 50 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;
type PreviewBackgroundEngine = EfxPaintEngine & {
  setBackgroundImageUrl: (dataUrl: string) => void;
  resetBackground: () => void;
  setPreviewBaseImageUrl: (dataUrl: string) => void;
  clearPreviewBaseImage: () => void;
};

interface PhysicsPaintActionContext {
  engine: EfxPaintEngine;
  launchContext: PhysicPaintLaunchContext;
  bridgeMode: PhysicsPaintBridgeMode;
}

async function sendPhysicPaintFrameSyncMessage(frame: number, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  const message = { type: 'physic-paint:seek-frame' as const, frame };
  if (bridgeMode === 'Tauri') {
    try {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.('physic-paint:seek-frame', message);
      await eventApi.emitTo?.('main', 'physic-paint:seek-frame', message);
      return;
    } catch {
      // Browser fallback below keeps development and non-Tauri windows synced.
    }
  }
  window.opener?.postMessage?.(message, '*');
  window.dispatchEvent?.(new MessageEvent('message', { data: message }));
}

async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload);
    return;
  }

  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);
    return;
  }

  throw new Error('App bridge is not connected');
}

function isPhysicsPaintShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return false;
  if (target.isContentEditable) return false;
  return !Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function shouldPersistRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length > 0 || state.settings.bgMode !== 'transparent';
}

function isBackgroundOnlyRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length === 0 && state.settings.bgMode !== 'transparent';
}

function addOccupiedRotoFrame(frames: number[], frame: number): number[] {
  return [...new Set([...frames, frame])].sort((a, b) => a - b);
}

function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement {
  const state = engine.save();
  const background = state.settings.bgMode as BgMode;
  try {
    engine.setBgMode('transparent');
    return engine.exportCompositeCanvas();
  } finally {
    engine.setBgMode(background);
    engine.load(state);
  }
}

function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }): RenderedFramePayload {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const dataUrl = outputCanvas.toDataURL('image/png');
  registerRotoAlphaCanvasFrame(dataUrl, outputCanvas);
  return {
    frameIndex: 0,
    appFrame,
    dataUrl,
    width: outputCanvas.width,
    height: outputCanvas.height,
  };
}

function drawCanvasAtSize(canvas: HTMLCanvasElement, size: { width: number; height: number }): HTMLCanvasElement {
  if (canvas.width === size.width && canvas.height === size.height) return canvas;
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
  context?.drawImage(canvas, 0, 0, size.width, size.height);
  return output;
}

function buildBlankRotoFrame(width: number, height: number, appFrame: number): RenderedFramePayload {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return buildRotoFrameFromCanvas(canvas, appFrame);
}

function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload {
  return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width, height });
}

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
  const rotoEditBuffer = useRotoEditBufferController<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>();
  const editableRotoFrames = rotoEditBuffer.editableFrames;
  const rotoFrameStatesRef = { get current() { return rotoEditBuffer.bufferRef.current.frameStates; }, set current(states) { rotoEditBuffer.replaceFrameStates(states); } };
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const rotoCapturedFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.capturedFrames; } };
  const liveRotoOverlayActionCountRef = { get current() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null);
  const playLimitToast = usePlayLimitToast();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const confirmedCachedRotoFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const workflowModeRef = useRef<PhysicsPaintWorkflowMode>(workflowMode);
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const closeGuardBypassRef = useRef(false);
  const saveOnLeaveRenderedFrameRef = useRef<{ renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const pendingCachedRotoMergeFrameRef = useRef<{ frame: number; renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const saveOnLeaveDeleteFrameRef = useRef<number | null>(null);
  const rotoKeyUtilitiesExternalRef = useRef<(Pick<RotoKeyUtilitiesInput<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>, 'syncRotoKeyFrameLists' | 'applyRotoKeyFrames' | 'persistRotoKeyFrameTransaction' | 'handleSaveFrameEffect' | 'restoreFrame' | 'clearCanvas' | 'navigate' | 'clearCachedReferenceFrame'> & { resetSession: () => void }) | null>(null);
  const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null);
  const resetRotoCachedPlaybackRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    rotoKeyUtilitiesExternalRef.current?.resetSession();
  }, []);
  const {
    activeOperationIdRef,
    pendingApplyRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    registerPendingApply,
    clearActiveApply,
    matchApplyResult,
    startApplyTimeout,
  } = useRotoApplyLifecycle({
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
  const {
    engine,
    engineRef,
    canvasMounted,
    setCanvasMounted,
    handleEngineReady,
    handleNativePenInputReady,
  } = usePhysicsPaintEngineLifecycle({
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
  const playEditCache = usePlayEditCacheController<RenderedFramePayload>({
    launchContext,
    currentFrame,
    workflowMode,
    engine,
    getStoredFrame: (layerId, appFrame) => physicPaintStore.getFrame(layerId, appFrame),
    setApplyMessage,
  });
  const {
    latestFrames: latestPlayFrames,
    latestFramesRef: latestPlayFramesRef,
    localPreviewFrame: localPlayPreviewFrame,
    localPreviewFrameRef,
    cachedPreviewUrl: cachedPlayPreviewUrl,
    cacheDirty: savedPlayCacheDirty,
    setLatestFrames: setLatestPlayFrames,
    setLocalPreviewFrame: setLocalPlayPreviewFrame,
    setCachedPreviewUrl: setCachedPlayPreviewUrl,
    setCacheDirty: setSavedPlayCacheDirty,
    bumpFramesVersion: bumpPlayFramesVersion,
    loadCachedPreviewFrame: loadCachedPlayPreviewFrame,
    getCachedFramesForRange: getCachedPlayFramesForRange,
    markSelectedCacheDirty: markSelectedPlayCacheDirty,
    capturePendingFrameEdits: capturePendingPlayFrameEdits,
    beginFrameEdit: beginPlayFrameEdit,
    previewLocalFrame: previewLocalPlayFrame,
    annotateState: annotatePlayState,
    resetFrameEdits: resetPlayFrameEdits,
    restoreFrameEdits: restorePlayFrameEdits,
  } = playEditCache;
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
  const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({
    workflowMode,
    settingsBackground: settings.background,
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    previewFrames: rotoPreviewFramesRef.current,
    confirmedFrames: confirmedCachedRotoFramesRef.current,
    dirtyFrames: dirtyRotoFramesRef.current,
    liveOverlayActionCounts: liveRotoOverlayActionCountRef.current,
    getRotoFrame: (appFrame) => launchContext ? physicPaintStore.getRotoFrame(launchContext.layerId, appFrame) : null,
    getFrame: (appFrame) => launchContext ? physicPaintStore.getFrame(launchContext.layerId, appFrame) : null,
    syncPending: () => rotoKeyUtilitiesExternalRef.current?.resetSession(),
    setApplyMessage,
  });
  const {
    cachedRotoReferenceUrl,
    cachedRotoRepaintBaseFrame,
    setCachedRotoReferenceUrl,
    setCachedRotoRepaintBaseFrame,
    clearCachedRotoReferenceUrl,
    resetCachedRotoReference,
    findCachedRotoDisplayFrame,
    loadCachedRotoReferenceFrame,
  } = rotoReferenceController;

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext, options: { preserveCloseAfterRotoSave?: boolean } = {}) => {
    if (getLaunchWorkflowMode(context) !== 'roto') return;
    rotoEditBuffer.resetForLaunch();
    confirmedCachedRotoFramesRef.current = new Map(selectRealCachedRotoFrames(context.cachedRotoFrames).map((frame) => [frame.appFrame, frame]));
    pendingRotoAdvanceRef.current = null;
    saveOnLeaveSourceFrameRef.current = null;
    saveOnLeaveRenderedFrameRef.current = null;
    pendingCachedRotoMergeFrameRef.current = null;
    saveOnLeaveDeleteFrameRef.current = null;
    if (!options.preserveCloseAfterRotoSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingApplyRef.current = null;
    }
    rotoFlushInFlightRef.current = null;
    resetRotoCachedPlaybackRef.current();
    rotoKeyUtilitiesExternalRef.current?.resetSession();
    setRotoSavingFrame(null);
    resetCachedRotoReference();
    if (!options.preserveCloseAfterRotoSave) {
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
  }, []);

  useEffect(() => {
    workflowModeRef.current = workflowMode;
  }, [workflowMode]);

  const getStrokeMetadata = useCallback(() => {
    if (workflowModeRef.current !== 'play') return null;
    const playFrame = localPreviewFrameRef.current;
    return Number.isInteger(playFrame) && playFrame >= 0 ? { playFrame } : null;
  }, []);

  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    const hydratedContext = hydrateRotoLaunchContext(context, physicPaintStore);
    const preserveCloseAfterRotoSave = closeAfterRotoSaveRequestedRef.current;
    resetRotoSessionForLaunch(hydratedContext, { preserveCloseAfterRotoSave });
    applyPhysicsPaintLaunchContext(hydratedContext, {
      setLaunchContext,
      setFramesToApply,
      setWorkflowMode,
      setLocalPlayPreviewFrame,
      setSavedPlayCacheDirty,
      setPlayWiggle,
      setSettings,
    }, (launch) => {
      if (launch.playRenderOptions) return applyPlayRenderOptionsSnapshotToSettings(launch.playRenderOptions);
      if (getLaunchWorkflowMode(launch) === 'roto' && launch.rotoBackground) return applyRotoBackgroundMetadataToSettings(launch.rotoBackground);
      return null;
    });
    const readyEngine = engineRef.current;
    if (readyEngine && getLaunchWorkflowMode(hydratedContext) === 'roto') loadCachedRotoReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine);
    if (!preserveCloseAfterRotoSave) {
      setApplyStatus('idle');
      setApplyMessage(null);
      setLastError(null);
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      closeAfterApplyOperationIdRef.current = null;
      closeGuardBypassRef.current = false;
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
  }, [loadCachedRotoReferenceFrame, resetRotoSessionForLaunch]);

  usePhysicsPaintLaunchBridge(applyIncomingLaunchContext);

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

  const rotoKeyUtilities = useRotoKeyUtilities<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>({
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
    syncRotoKeyFrameLists: (cacheFrames) => rotoKeyUtilitiesExternalRef.current?.syncRotoKeyFrameLists(cacheFrames),
    applyRotoKeyFrames: (transaction) => rotoKeyUtilitiesExternalRef.current?.applyRotoKeyFrames(transaction) ?? [],
    persistRotoKeyFrameTransaction: (transaction) => rotoKeyUtilitiesExternalRef.current?.persistRotoKeyFrameTransaction(transaction) ?? Promise.resolve(),
    handleSaveFrameEffect: (effect, session) => rotoKeyUtilitiesExternalRef.current?.handleSaveFrameEffect(effect, session) ?? Promise.resolve(false),
    restoreFrame: (effect) => rotoKeyUtilitiesExternalRef.current?.restoreFrame(effect),
    clearCanvas: (frame) => rotoKeyUtilitiesExternalRef.current?.clearCanvas(frame),
    showCachedReference: (frame) => setCachedRotoReferenceUrl(frame.dataUrl),
    navigate: (frame) => rotoKeyUtilitiesExternalRef.current?.navigate(frame) ?? Promise.resolve(),
    clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, frame, 1); },
    clearCachedReferenceFrame: (frame) => rotoKeyUtilitiesExternalRef.current?.clearCachedReferenceFrame(frame),
    clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, frame); },
    snapshotCurrentRotoFrame: () => { snapshotCurrentRotoFrame(); },
    setApplyMessage,
    setApplyStatus,
    setLastError,
    setRotoSavingFrame,
  });
  const rotoSession = rotoKeyUtilities.session;
  const executeRotoSessionEffects = rotoKeyUtilities.executeSessionEffects;
  const runRotoSessionResult = rotoKeyUtilities.runSessionResult;
  const duplicateRotoKey = rotoKeyUtilities.duplicateKey;
  const insertRotoFrame = rotoKeyUtilities.insertBlankKey;
  const deleteRotoFrame = rotoKeyUtilities.deleteKey;
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;

  const undo = useCallback(() => {
    engine?.undo();
    if (workflowMode === 'roto' && cachedRotoRepaintBaseFrame?.appFrame === currentFrame) {
      const result = rotoEditBuffer.undoOverlay(currentFrame);
      if (result === 'empty') {
        rotoSession.markLiveOverlayEmpty(currentFrame);
        syncPendingRotoFrames();
      }
    }
  }, [cachedRotoRepaintBaseFrame, currentFrame, engine, rotoSession, syncPendingRotoFrames, workflowMode]);

  useRotoBackgroundMetadataSync({ launchContext, workflowMode, settings });

  function findCachedRotoPlaybackFrame(appFrame: number): RenderedFramePayload | null {
    return findCachedRotoDisplayFrame(appFrame);
  }

  function getRotoCachedPlaybackFrames(): Array<{ appFrame: number; frame: RenderedFramePayload | null }> {
    return rotoSession.playbackFrameNumbers.value.map((appFrame) => ({ appFrame, frame: findCachedRotoPlaybackFrame(appFrame) }));
  }

  const rotoCachedPlayback = useRotoCachedPlayback({
    initialFps: getPreviewFps(launchContext?.fps),
    workflowMode,
    getFrames: getRotoCachedPlaybackFrames,
    onStart: (frameCount) => setAnimTotal(frameCount),
    onFrame: (frameIndex, appFrame) => {
      setAnimFrame(frameIndex);
      setLaunchContext((current) => current ? { ...current, startFrame: appFrame } : current);
    },
    setIsPlaying,
  });
  resetRotoCachedPlaybackRef.current = rotoCachedPlayback.resetForLaunch;
  const playPreviewController = usePlayPreviewController<RenderedFramePayload>({
    engine,
    previewFps,
    wiggle: playWiggle,
    getCachedFrames: getCachedPlayFramesForRange,
    capturePendingFrameEdits: capturePendingPlayFrameEdits,
    annotateState: annotatePlayState,
    setCachedPreviewUrl: setCachedPlayPreviewUrl,
    setApplyMessage,
    stopRotoPlayback: rotoCachedPlayback.stop,
    setIsPlaying,
    setAnimFrame,
    setAnimTotal,
  });
  const playPreview = playPreviewController.preview;
  const stopPreview = playPreviewController.stop;

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

  useEffect(() => {
    if (workflowMode !== 'play') return;
    if (savedPlayCacheDirty) return;
    loadCachedPlayPreviewFrame(localPlayPreviewFrame);
  }, [engine, launchContext, localPlayPreviewFrame, savedPlayCacheDirty, workflowMode]);

  useEffect(() => {
    if (workflowMode !== 'roto') return;
    loadCachedRotoReferenceFrame(currentFrame, engine as PreviewBackgroundEngine | null);
  }, [currentFrame, engine, loadCachedRotoReferenceFrame, launchContext, workflowMode]);

  const updatePlayFrameCount = useCallback((frameCount: number) => {
    const update = resolvePlayFrameCountUpdate({
      requestedFrameCount: frameCount,
      maxFrameCount: launchContext?.maxPlayFrameCount,
      maxFrameCountReason: launchContext?.maxPlayFrameCountReason,
    });
    if (update.limitMessage) playLimitToast.show(update.limitMessage);
    setFramesToApply(update.frameCount);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playFrameCount: update.frameCount }) : current);
  }, [launchContext?.maxPlayFrameCount, launchContext?.maxPlayFrameCountReason, markSelectedPlayCacheDirty, playLimitToast.show, workflowMode]);

  const updatePlayWiggle = useCallback((wiggle: AnimationWiggleConfig) => {
    const normalized = normalizePlayMotionUpdate(wiggle);
    setPlayWiggle(normalized);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playMotion: normalized }) : current);
  }, [markSelectedPlayCacheDirty, workflowMode]);

  const addEditableRotoFrame = rotoEditBuffer.addEditableFrame;
  const removeEditableRotoFrame = rotoEditBuffer.removeEditableFrame;

  const upsertCachedRotoFrameInLaunchContext = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null, interpolationSettings?: PhysicPaintRotoInterpolationSettings) => {
    const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame;
    const normalizedRenderedFrame = { ...renderedFrame, appFrame: sourceFrame };
    confirmedCachedRotoFramesRef.current.set(sourceFrame, normalizedRenderedFrame);
    setLaunchContext((current) => {
      if (!current) return current;
      const previousDisplayFrame = current.startFrame;
      const frameForCache = { ...normalizedRenderedFrame, source: 'real-key' as const, sourceFrame, displayFrame: sourceFrame };
      physicPaintStore.upsertRealRotoKeyFrame(current.layerId, sourceFrame, frameForCache, backgroundOnly);
      if (interpolationSettings) physicPaintStore.setRotoInterpolationSettings(current.layerId, interpolationSettings);
      const manualFrames = upsertCachedRotoCacheFrame(current.cachedRotoFrames, frameForCache, backgroundOnly, onionFrame);
      const storeFrames = physicPaintStore.getRotoCacheFrames(current.layerId);
      const settings = physicPaintStore.getRotoInterpolationSettings(current.layerId);
      const refreshedRotoFrames = settings.enabled && storeFrames.length > 0 ? storeFrames : manualFrames;
      const nextDisplayFrame = refreshedRotoFrames.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === sourceFrame)?.appFrame ?? sourceFrame;
      confirmedCachedRotoFramesRef.current = new Map(refreshedRotoFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
      rotoEditBuffer.setEditableFrameList((frames) => {
        const withoutStaleFrames = frames.filter((frame) => frame !== previousDisplayFrame && frame !== sourceFrame && frame !== nextDisplayFrame);
        return backgroundOnly ? withoutStaleFrames : addOccupiedRotoFrame(withoutStaleFrames, nextDisplayFrame);
      });
      return {
        ...current,
        startFrame: nextDisplayFrame,
        cachedRotoFrames: refreshedRotoFrames,
        rotoInterpolationSettings: settings,
      };
    });
  }, []);

  const removeCachedRotoFrameFromLaunchContext = useCallback((appFrame: number) => {
    confirmedCachedRotoFramesRef.current.delete(appFrame);
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: removeCachedRotoCacheFrame(current.cachedRotoFrames, appFrame),
    } : current);
  }, []);

  const markCurrentRotoFrameDirty = useCallback(() => {
    if (workflowMode !== 'roto') return;
    if (currentFrameIsGeneratedRoto) {
      setApplyMessage(`Generated frame ${currentFrame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.`);
      return;
    }
    const appFrame = currentFrame;
    rotoEditBuffer.markDirty(appFrame);
    rotoSession.markLiveOverlayDirty(appFrame);
    clearCachedRotoReferenceUrl();
    rotoCachedPlayback.stop();
    (engine as PreviewBackgroundEngine | null)?.resetBackground?.();
    syncPendingRotoFrames();
  }, [clearCachedRotoReferenceUrl, currentFrame, currentFrameIsGeneratedRoto, engine, rotoSession, syncPendingRotoFrames, workflowMode]);

  const beginRotoFrameEdit = useCallback(() => {
    rotoCachedPlayback.stop();
    markCurrentRotoFrameDirty();
  }, [markCurrentRotoFrameDirty, rotoCachedPlayback.stop]);

  const clearActiveSource = useCallback(() => {
    if (!engine || !launchContext) return;
    engine.clear();
    if (workflowMode === 'roto') {
      if (cachedRotoRepaintBaseFrame?.appFrame === currentFrame) {
        rotoEditBuffer.clearCachedOverlay(currentFrame);
        rotoSession.markLiveOverlayEmpty(currentFrame);
        syncPendingRotoFrames();
        setApplyStatus('success');
        setApplyMessage(`Cleared live repaint strokes for frame ${currentFrame}; cached base preserved.`);
        return;
      }
      rotoEditBuffer.clearFrame(currentFrame);
      syncPendingRotoFrames();
      if (!cachedRotoRepaintBaseFrame) setCachedRotoReferenceUrl(null);
      setApplyStatus('success');
      setApplyMessage(`Cleared roto frame ${currentFrame}.`);
      return;
    }
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

  const snapshotCurrentRotoFrame = useCallback(() => {
    if (!engine || !launchContext) return false;
    const appFrame = currentFrame;
    const currentState = engine.save();
    const hasCachedReference = Boolean(cachedRotoReferenceUrl || cachedRotoRepaintBaseFrame?.appFrame === appFrame);
    const shouldCapture = !(hasCachedReference && !dirtyRotoFramesRef.current.has(appFrame)) && shouldPersistRotoFrame(currentState);
    const capturedFrame = shouldCapture
      ? buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width: canvasWidth, height: canvasHeight })
      : buildBlankRotoFrame(canvasWidth, canvasHeight, appFrame);
    return rotoEditBuffer.snapshotFrame({
      frame: appFrame,
      state: currentState,
      capturedFrame,
      hasCachedReference,
      shouldPersist: shouldPersistRotoFrame(currentState),
    });
  }, [addEditableRotoFrame, cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, canvasHeight, canvasWidth, currentFrame, engine, launchContext, removeEditableRotoFrame]);

  const { flushRotoFrame, saveRotoFrame, savePendingRotoFrames } = useRotoSaveController({
    getActionContext: () => actionContext,
    getCurrentFrame: () => currentFrame,
    getReadyToApply: () => readyToApply,
    getCurrentFrameIsGenerated: () => currentFrameIsGeneratedRoto,
    getCachedRepaintFrame: (frame) => cachedRotoRepaintBaseFrame?.appFrame === frame ? cachedRotoRepaintBaseFrame : null,
    getEditableState: (frame) => rotoFrameStatesRef.current.get(frame),
    setEditableState: (frame, state) => { rotoFrameStatesRef.current.set(frame, state); },
    getCapturedFrame: (frame) => rotoCapturedFramesRef.current.get(frame),
    deleteCapturedFrame: (frame) => { rotoCapturedFramesRef.current.delete(frame); },
    setPreviewFrame: (frame, renderedFrame) => { rotoPreviewFramesRef.current.set(frame, renderedFrame); },
    dirtyFramesRef: dirtyRotoFramesRef,
    flushInFlightRef: rotoFlushInFlightRef,
    pendingAdvanceRef: pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    saveOnLeaveRenderedFrameRef,
    pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
    saveOnLeaveDeleteFrameRef,
    resolveSourceFrame: resolveRotoSourceFrameForDisplayFrame,
    getInterpolationSettings: (layerId) => physicPaintStore.getRotoInterpolationSettings(layerId),
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    saveRealKeyAtDisplayFrame: rotoTimelineActions.saveRealKeyAtDisplayFrame,
    snapshotCurrentFrame: snapshotCurrentRotoFrame,
    renderFrame: async ({ engine: saveEngine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame }) => {
      const backgroundOnly = isBackgroundOnlyRotoFrame(editableState);
      const liveAlphaCanvas = exportTransparentStrokeCanvas(saveEngine);
      const renderedFrame = cachedRepaintBase
        ? await mergeCachedRotoAlphaFrame(cachedRepaintBase, liveAlphaCanvas, sourceFrame, { width: canvasWidth, height: canvasHeight })
        : { ...(capturedFrame ?? buildRotoOutputFrame(saveEngine, frame, canvasWidth, canvasHeight)), appFrame: sourceFrame };
      return { renderedFrame, backgroundOnly, onionFrame: backgroundOnly ? null : renderedFrame, cachedRepaint: Boolean(cachedRepaintBase) };
    },
    resetBackground: (saveEngine) => { (saveEngine as PreviewBackgroundEngine).resetBackground(); },
    addEditableFrame: addEditableRotoFrame,
    removeEditableFrame: removeEditableRotoFrame,
    removeCachedFrame: removeCachedRotoFrameFromLaunchContext,
    upsertCachedFrame: (save, interpolationSettings) => upsertCachedRotoFrameInLaunchContext(save.renderedFrame, save.backgroundOnly, save.onionFrame, interpolationSettings),
    setCachedReferenceUrl: setCachedRotoReferenceUrl,
    restoreCachedRepaintFrame: setCachedRotoRepaintBaseFrame,
    requestSessionFrame: (frame) => { void rotoSession.requestFrame(frame); },
    getSessionSavingFrame: () => rotoSession.savingFrame.value,
    registerPendingApply,
    sendApplyPayload: sendPhysicPaintApplyPayload,
    startApplyTimeout,
    syncPendingFrames: syncPendingRotoFrames,
    setApplyStatus,
    setApplyMessage,
    setLastError,
    setSavingFrame: setRotoSavingFrame,
  });

  const {
    rotoClosePromptState,
    rotoClosePromptMessage,
    setRotoClosePromptState,
    setRotoClosePromptMessage,
    closePhysicsPaintWindow,
    closeWithoutSavingRotoFrame,
    cancelRotoClose,
    saveAndCloseRotoFrame,
  } = useRotoCloseLifecycle({
    workflowMode,
    currentFrame,
    dirtyFramesRef: dirtyRotoFramesRef,
    closeGuardBypassRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    snapshotCurrentRotoFrame,
    saveCurrentRotoFrame: (options) => saveRotoFrame(null, options),
  });

  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    if (rotoFlushInFlightRef.current || applyStatus === 'applying') return false;
    rotoCachedPlayback.stop();
    clearCachedRotoReferenceUrl();
    if (engine && launchContext) {
      snapshotCurrentRotoFrame();
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [applyStatus, bridgeMode, engine, launchContext, snapshotCurrentRotoFrame, rotoCachedPlayback.stop]);

  const openSyncedRotoFrameAfterSave = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    rotoCachedPlayback.stop();
    clearCachedRotoReferenceUrl();
    if (engine && launchContext) {
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, engine, launchContext, rotoCachedPlayback.stop]);

  const syncRotoKeyFrameLists = useCallback((cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => {
    if (!cacheFrames) return;
    confirmedCachedRotoFramesRef.current = new Map(cacheFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: [...cacheFrames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex),
    } : current);
  }, []);

  const applyRotoKeyFrames = useCallback((transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext) return [];
    if (transaction.segmentSpacingOverrides) physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, { segmentSpacingOverrides: [...transaction.segmentSpacingOverrides] });
    physicPaintStore.replaceRotoKeyFrames({
      operationId: `${launchContext.operationId}:local-roto-keys:${Date.now()}`,
      kind: 'replace-roto-key-frames',
      layerId: launchContext.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames,
    });
    return physicPaintStore.getRotoCacheFrames(launchContext.layerId);
  }, [launchContext]);

  const persistRotoKeyFrameTransaction = useCallback(async (transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext || actionContext?.bridgeMode === 'Unavailable') throw new Error('App bridge is not connected.');
    if (transaction.realKeyFrames.length !== transaction.realKeyFrameNumbers.length) throw new Error('Roto key cache is incomplete after the action.');
    const operationId = `${launchContext.operationId}:roto-keys:${Date.now()}`;
    const payload: PhysicPaintApplyPayload & { rotoInterpolationSettings: PhysicPaintRotoInterpolationSettings } = {
      operationId,
      kind: 'replace-roto-key-frames',
      layerId: launchContext.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames,
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    };
    activeOperationIdRef.current = operationId;
    registerPendingApply(payload);
    pendingRotoKeyActionMessageRef.current = transaction.successMessage;
    setApplyStatus('applying');
    setApplyMessage('Saving Roto key changes...');
    await sendPhysicPaintApplyPayload(payload, actionContext?.bridgeMode ?? 'Unavailable');
    startApplyTimeout(operationId);
  }, [actionContext?.bridgeMode, launchContext, startApplyTimeout]);

  const restoreRotoFrameFromSessionEffect = useCallback((effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>) => {
    const restore: RotoKeyUtilityActiveRestore = effect.restore;
    if (restore.kind === 'blank-real-key' || restore.kind === 'clear-blank') {
      setCachedRotoReferenceUrl(null);
      if (engine && effect.frame === currentFrame) {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
    } else if (restore.kind === 'load-real-key' && engine && effect.frame === currentFrame) {
      setCachedRotoReferenceUrl(null);
      loadCachedRotoReferenceFrame(restore.frame, engine as PreviewBackgroundEngine);
    }
  }, [currentFrame, engine]);

  rotoKeyUtilitiesExternalRef.current = {
    resetSession: rotoKeyUtilities.resetSession,
    syncRotoKeyFrameLists,
    applyRotoKeyFrames,
    persistRotoKeyFrameTransaction,
    handleSaveFrameEffect: async (effect) => {
      saveOnLeaveSourceFrameRef.current = effect.frame;
      setRotoSavingFrame(effect.frame);
      pendingRotoAdvanceRef.current = effect.after.type === 'navigate' ? effect.after.frame : null;
      setApplyStatus('applying');
      const actionCopy = effect.after.type === 'keyAction' ? effect.after.operation : null;
      setApplyMessage(effect.reason === 'beforeNavigate'
        ? `Saving frame ${effect.frame} before navigation...`
        : `Saving frame ${effect.frame} before ${actionCopy ?? 'key action'}...`);
      return Boolean(await flushRotoFrame(effect.frame, { force: true, advanceToFrame: effect.after.type === 'navigate' ? effect.after.frame : null }));
    },
    restoreFrame: restoreRotoFrameFromSessionEffect,
    clearCanvas: (frame) => {
      setCachedRotoReferenceUrl(null);
      if (engine && frame === currentFrame) {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
    },
    navigate: openSyncedRotoFrameAfterSave,
    clearCachedReferenceFrame: removeCachedRotoFrameFromLaunchContext,
  };

  const requestRotoFrameNavigation = useCallback(async (targetFrame: number) => {
    if (!Number.isInteger(targetFrame) || targetFrame < 0) return false;
    if (workflowMode !== 'roto') return navigateToSyncedFrame(targetFrame);
    const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current;
    if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current) {
      pendingRotoAdvanceRef.current = targetFrame;
      return false;
    }
    snapshotCurrentRotoFrame();
    const result = rotoSession.requestFrame(targetFrame);
    if (!result.ok) {
      if (result.message) setApplyMessage(result.message);
      return false;
    }
    if (result.effects.some((effect) => effect.type === 'navigate')) {
      await executeRotoSessionEffects(result.effects);
      return true;
    }
    await runRotoSessionResult(result);
    return result.effects.some((effect) => effect.type === 'saveFrame');
  }, [executeRotoSessionEffects, navigateToSyncedFrame, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame, workflowMode]);

  const { handleRotoApplyResult } = useRotoApplyResultController({
    pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef,
    pendingAdvanceRef: pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    saveOnLeaveRenderedFrameRef,
    pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
    saveOnLeaveDeleteFrameRef,
    dirtyFramesRef: dirtyRotoFramesRef,
    capturedFramesRef: rotoCapturedFramesRef,
    frameStatesRef: rotoFrameStatesRef,
    liveOverlayActionCountsRef: liveRotoOverlayActionCountRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    closeGuardBypassRef,
    getSessionSavingFrame: () => rotoSession.savingFrame.value,
    onSessionSaveFailed: rotoSession.onSaveFailed,
    onSessionSaveSucceeded: rotoSession.onSaveSucceeded,
    getSessionDirtyFrames: () => rotoSession.dirtyFrames.value,
    executeSessionEffects: executeRotoSessionEffects,
    syncPendingFrames: syncPendingRotoFrames,
    upsertCachedFrame: (save) => upsertCachedRotoFrameInLaunchContext(save.renderedFrame, save.backgroundOnly, save.onionFrame),
    removeCachedFrame: removeCachedRotoFrameFromLaunchContext,
    removeEditableFrame: removeEditableRotoFrame,
    setCachedReferenceUrl: setCachedRotoReferenceUrl,
    setCachedRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
    getEngine: () => engine,
    getCurrentFrame: () => currentFrame,
    getBackgroundMode: () => settings.background,
    restorePreviewBase: (saveEngine, dataUrl) => { (saveEngine as PreviewBackgroundEngine).setPreviewBaseImageUrl(dataUrl); },
    openFrameAfterSave: async (frame) => { await openSyncedRotoFrameAfterSave(frame); },
    closeWindow: closePhysicsPaintWindow,
    setApplyStatus,
    setApplyMessage,
    setLastError,
    setSavingFrame: setRotoSavingFrame,
    setClosePromptState: setRotoClosePromptState,
    setClosePromptMessage: setRotoClosePromptMessage,
  });

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    const transition = matchApplyResult(detail);
    if (transition.type === 'ignore') return;
    if (transition.type === 'mismatch') {
      setApplyStatus('error');
      setApplyMessage(transition.message);
      setLastError(transition.message);
      return;
    }
    if (handleRotoApplyResult(transition)) return;

    const shouldCloseAfterSave = transition.shouldCloseAfterSave;
    detail = transition.detail;
    if (!transition.ok) {
      const message = transition.message ?? 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      const diagnostic = detail.error;
      setApplyStatus('error');
      setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message);
      setLastError(diagnostic ? `${message} ${diagnostic}` : message);
      return;
    }

    if (shouldCloseAfterSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
    setApplyStatus('success');
    setLastError(null);
    if (detail.kind === 'update-play-render-options') {
      setApplyMessage(detail.appliedFrameCount > 0 ? 'Play options updated. Cached frames cleared; use Render play.' : 'Play options already up to date.');
    } else if (detail.kind === 'apply-play-canvas') {
      const count = detail.appliedFrameCount;
      const frame = detail.startFrame;
      const endFrame = frame + Math.max(0, count - 1);
      setApplyMessage(`Saved play range: ${count} frames from ${frame} to ${endFrame} at ${canvasWidth}×${canvasHeight}.`);
    } else if (detail.kind === 'convert-play-to-roto') {
      setApplyMessage(`Converted ${detail.appliedFrameCount} Play frames to Roto frames.`);
    } else if (detail.kind === 'convert-roto-to-play') {
      const endFrame = detail.startFrame + Math.max(0, detail.appliedFrameCount - 1);
      setApplyMessage(`Converted Roto frames ${detail.startFrame}–${endFrame} to the current Play canvas source.`);
    }
  }, [canvasHeight, canvasWidth, handleRotoApplyResult, matchApplyResult]);

  usePhysicsPaintApplyResultBridge(bridgeMode, handleApplyResult);

  const updateSelectedPlayOptions = useCallback(async () => {
    if (!actionContext || workflowMode !== 'play') return null;
    const { launchContext, bridgeMode } = actionContext;
    const scriptId = launchContext.selectedPlayScriptId;
    if (!scriptId) {
      setApplyStatus('error');
      setApplyMessage('No saved Play script is selected to update.');
      return null;
    }
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
    const operationId = `${launchContext.operationId}:update-play-options:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-play-render-options',
      operationId,
      layerId: launchContext.layerId,
      startFrame: getActivePlayStartFrame(launchContext, currentFrame),
      playScriptId: scriptId,
      renderOptions,
    };
    try {
      setApplyStatus('applying');
      setApplyMessage('Updating Play options...');
      setLastError(null);
      activeOperationIdRef.current = operationId;
      registerPendingApply(payload);
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      const update = resolvePlayOptionsUpdate({ context: launchContext, renderOptions });
      const changed = update.changed;
      setLaunchContext((current) => current ? resolvePlayOptionsUpdate({ context: current, renderOptions }).context : current);
      if (changed) {
        latestPlayFramesRef.current = [];
        setLatestPlayFrames([]);
        setCachedPlayPreviewUrl(null);
        setSavedPlayCacheDirty(true);
        bumpPlayFramesVersion();
        setApplyMessage('Play options updated. Cached frames cleared; use Render play.');
      } else {
        setApplyMessage('Play options already up to date.');
      }
      return payload;
    } catch (error) {
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not update Play options. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, currentFrame, playWiggle, settings, startApplyTimeout, workflowMode]);

  const savePlay = useCallback(async () => {
    if (!actionContext || !readyToApply) return null;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame);
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
    capturePendingPlayFrameEdits();
    const editableState = annotatePlayState(engine.save());
    (engine as PreviewBackgroundEngine).resetBackground();
    engine.load(editableState);

    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      const operationId = `${launchContext.operationId}:play:${Date.now()}`;
      activeOperationIdRef.current = operationId;

      const frames = await playPreviewController.renderFrames({ frameCount, startFrame: playStartFrame });

      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-play-canvas',
        layerId: launchContext.layerId,
        startFrame: playStartFrame,
        frameCount,
        frames,
        editableState,
        playScriptId: launchContext.selectedPlayScriptId,
        playMotion: playWiggle,
        renderOptions,
      };
      latestPlayFramesRef.current = frames;
      setLatestPlayFrames(frames);
      setCachedPlayPreviewUrl(frames[0]?.dataUrl ?? null);
      setSavedPlayCacheDirty(false);
      setLocalPlayPreviewFrame(0);
      bumpPlayFramesVersion();
      resetPlayFrameEdits();
      setLaunchContext((current) => current ? applyRenderedPlayCache({
        context: current,
        currentFrame,
        frameCount,
        frames,
        motion: playWiggle,
        renderOptions,
      }) : current);
      registerPendingApply(payload);
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      playPreviewController.stopPlayOnly();
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      setIsPlaying(false);
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, capturePendingPlayFrameEdits, currentFrame, framesToApply, playPreviewController.renderFrames, playPreviewController.stopPlayOnly, playWiggle, readyToApply, settings, startApplyTimeout]);

  const { saveEditableState, loadEditableState, exportDebugProof } = usePhysicsPaintSessionController({
    engine,
    workflowMode,
    framesToApply,
    canvasSize: { width: canvasWidth, height: canvasHeight },
    launchContext,
    currentFrame,
    previewFps,
    capturePendingPlayFrameEdits,
    annotatePlayState,
    restorePlayFrameEdits,
    clearLatestPlayFrames: () => setLatestPlayFrames([]),
    setCachedPlayPreviewUrl,
    setSavedPlayCacheDirty,
    setLocalPlayPreviewFrame,
    setFramesToApply,
    bumpPlayFramesVersion,
    setLaunchContext,
    setApplyStatus,
    setApplyMessage,
    setLastError,
  });

  const { convertPlayToRoto, convertRotoToPlay } = useRotoPlayConversionController({
    getActionContext: () => actionContext,
    getCurrentFrame: () => currentFrame,
    getRequestedFrameCount: () => framesToApply,
    getLatestPlayFrames: () => latestPlayFramesRef.current,
    getPlayWiggle: () => playWiggle,
    getRenderOptions: () => buildPlayRenderOptionsSnapshot(settings, playWiggle),
    registerPendingApply,
    startApplyTimeout,
    clearActiveApply,
    sendApplyPayload: sendPhysicPaintApplyPayload,
    getCachedRotoFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId),
    setFrame: (layerId, frame, renderedFrame) => physicPaintStore.setFrame(layerId, frame, renderedFrame),
    setEditableState: (layerId, state) => physicPaintStore.setEditableState(layerId, state),
    removeFrameRange: (layerId, startFrame, frameCount) => physicPaintStore.removeFrameRange(layerId, startFrame, frameCount),
    resetLatestPlayFrames: () => {
      latestPlayFramesRef.current = [];
      setLatestPlayFrames([]);
    },
    resetPlayPreview: () => setCachedPlayPreviewUrl(null),
    markPlayCacheDirty: () => setSavedPlayCacheDirty(true),
    resetPlayFrameEdits,
    setLaunchContext,
    setWorkflowMode,
    setApplyStatus,
    setApplyMessage,
    setLastError,
  });

  const handlePhysicsPaintKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isPhysicsPaintShortcutTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;

    if (meta && key === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key === 'Escape') {
      if (isPlaying) {
        event.preventDefault();
        stopPreview();
      }
      return;
    }
    if (meta && key === 's') {
      event.preventDefault();
      if (workflowMode === 'play') void savePlay();
      else void saveRotoFrame(null);
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault();
      setShortcutsVisible((visible) => !visible);
      return;
    }

    if (workflowMode === 'roto') {
      if (event.key === ' ') {
        event.preventDefault();
        rotoCachedPlayback.toggle();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextFrame = event.shiftKey
          ? findAdjacentSavedFrame(timelineSavedRotoFrames, currentFrame, direction)
          : Math.max(0, currentFrame + direction);
        if (nextFrame !== null) void requestRotoFrameNavigation(nextFrame);
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        void requestRotoFrameNavigation(currentFrame);
        return;
      }
      if (key === 'o') {
        event.preventDefault();
        setOnion((current) => ({ ...current, enabled: !current.enabled }));
        return;
      }
      if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        setOnion((current) => ({ ...current, count: clampOnionCount(current.count + (event.key === ']' ? 1 : -1)) }));
        return;
      }
      if (meta && event.key === 'Enter') {
        event.preventDefault();
        void saveRotoFrame(null);
        return;
      }
    }

    if (workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      if (isPlaying) stopPreview();
      else if (!savedPlayCacheDirty && getCachedPlayFramesForRange(framesToApply)) playPreview(framesToApply);
      else void savePlay();
    }
  }, [currentFrame, framesToApply, isPlaying, playPreview, requestRotoFrameNavigation, savePlay, saveRotoFrame, savedPlayCacheDirty, stopPreview, timelineSavedRotoFrames, rotoCachedPlayback.toggle, undo, workflowMode]);

  const onionPreviewFrames = projectRotoOnionPreviewFrames({
    currentFrame,
    isPlaying,
    onion,
    launchFrames: launchContext?.cachedRotoFrames,
    storeFrames: launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : [],
    previewFrames: rotoPreviewFramesRef.current,
    dirtyFrames: dirtyRotoFramesRef.current,
  });
  const missingPlayFramesForConversion = selectPlayConversionMissingFrames({
    hasLaunchContext: Boolean(launchContext),
    currentFrame,
    requestedFrameCount: framesToApply,
    latestFrames: latestPlayFramesRef.current,
  });
  const currentPlayCacheStatus = selectCurrentPlayCacheStatus({
    workflowMode,
    cacheDirty: savedPlayCacheDirty,
    hasCachedRange: Boolean(getCachedPlayFramesForRange(framesToApply)),
  });
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: getRotoCachedPlaybackFrames(),
  });

  const updateRotoInterpolationSettings = useCallback((patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    if (!launchContext) return;
    seedRotoLaunchRealKeys(launchContext, physicPaintStore);
    const transaction = rotoTimelineActions.updateInterpolationSettings(currentFrame, patch);
    const cacheRefresh = refreshRotoInterpolationCache(
      launchContext.cachedRotoFrames,
      physicPaintStore.getRotoCacheFrames(launchContext.layerId),
      transaction.settings.enabled,
    );
    if (!transaction.settings.enabled) {
      rotoEditBuffer.setEditableFrameList((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)));
      confirmedCachedRotoFramesRef.current = new Map(cacheRefresh.confirmedRealKeys);
    }
    setLaunchContext((current) => current ? {
      ...current,
      startFrame: transaction.nextCurrentFrame,
      cachedRotoFrames: cacheRefresh.frames,
      rotoInterpolationSettings: transaction.settings,
    } : current);
    if (transaction.nextCurrentFrame !== currentFrame) void sendPhysicPaintFrameSyncMessage(transaction.nextCurrentFrame, bridgeMode);
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-roto-interpolation-settings',
      operationId: `${launchContext.operationId}:roto-interpolation:${Date.now()}`,
      layerId: launchContext.layerId,
      startFrame: transaction.nextCurrentFrame,
      settings: transaction.settings,
    };
    void sendPhysicPaintApplyPayload(payload, bridgeMode).catch((error) => {
      const message = `Could not sync interpolation settings to EFX Motion. ${error instanceof Error ? error.message : String(error)}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    });
    setApplyStatus(transaction.failureStatus ? 'error' : 'success');
    setApplyMessage(transaction.status);
    setLastError(transaction.failureStatus);
    rotoCachedPlayback.setStatus(transaction.status);
  }, [bridgeMode, currentFrame, launchContext, rotoCachedPlayback.setStatus, rotoTimelineActions]);

  const rotoNavigationActions = createRotoNavigationActions({
    getTargets: () => getRotoNavigationTargets({ currentFrame, framesToApply, savedFrames: timelineSavedRotoFrames, playFrames: latestPlayFrames }),
    requestNavigation: requestRotoFrameNavigation,
  });
  const { goToFirstFrame, goToPreviousFrame, goToNextFrame, goToLastFrame } = rotoNavigationActions;

  return (
    <PhysicsPaintStudioView
      layout={{
        rightPanelCollapsed,
        onKeyDown: handlePhysicsPaintKeyDown,
        onSetRightPanelCollapsed: setRightPanelCollapsed,
      }}
      topBar={{
        brushSize: settings.size, opacity: settings.opacity, background: settings.background, paperGrain: settings.paperGrain, grainStrength: settings.grainStrength, ready: readyToApply,
        onBrushSizeChange: setBrushSize, onOpacityChange: setBrushOpacity, onBackgroundChange: setBackground, onPaperGrainChange: setPaperGrain, onGrainStrengthChange: setGrainStrength,
      }}
      toolRail={{
        activeTool: settings.tool, physicsMode: settings.physicsMode, activePhysicsAction: settings.activePhysicsAction, canUndo: Boolean(engine), disabled: !engine,
        onSelectTool: selectTool, onUndo: undo, onClearFrame: clearActiveSource, onPhysicsStart: startPhysics, onPhysicsStop: stopPhysics, onDryPaint: dryPaint,
      }}
      canvas={{
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
      }}
      rightPanel={{
        activeTool: settings.tool, color: settings.color, opacity: settings.opacity, edgeDetail: settings.edgeDetail, pickup: settings.pickup, spread: settings.spread, smoothing: settings.smoothing, eraseStrength: settings.eraseStrength, physicsMode: settings.physicsMode,
        onion, onionDisabled: isPlaying, playWiggle, devExportEnabled: isPhysicsPaintDevExportEnabled(import.meta.env), devExportBusy: applyStatus === 'applying', applyStatus, applyMessage, error: lastError,
        onExportDebugProof: exportDebugProof, onColorChange: setBrushColor, onEdgeDetailChange: setEdgeDetail, onPickupChange: setPickup, onSpreadChange: setSpread, onSmoothingChange: setSmoothing, onEraseStrengthChange: setEraseStrength,
        onOnionChange: setOnion, onPlayWiggleChange: updatePlayWiggle, onSaveState: saveEditableState, onLoadState: loadEditableState,
      }}
      workflow={{
        mode: workflowMode, currentFrame, startFrame: launchContext?.startFrame ?? 0, frameCount: framesToApply, currentPreviewFrame: localPlayPreviewFrame, maxPlayFrameCount: launchContext?.maxPlayFrameCount, maxPlayFrameCountReason: launchContext?.maxPlayFrameCountReason,
        playCacheStatus: currentPlayCacheStatus, onPlayLimit: playLimitToast.show, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames, editableRotoFrames, pendingRotoFrames: rotoSession.dirtyFrames.value,
        rotoSaveInFlight: Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying', keyActionInFlight: rotoKeyUtilities.keyActionInFlight, rotoSavingFrame, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: rotoCachedPlayback.setLoop, onRotoPlaybackFpsChange: rotoCachedPlayback.updateFps, rotoInterpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
        onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled }), onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount }),
        onDuplicateRotoKey: duplicateRotoKey, onInsertRotoFrame: insertRotoFrame, onDeleteRotoFrame: deleteRotoFrame, onCopyRotoFrame: copyRotoFrame, onPasteRotoFrame: pasteRotoFrame, hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        playPublicationSummary: applyStatus === 'success' ? applyMessage : null, statusMessage: isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying, missingPlayFramesForConversion,
        onSaveRotoFrame: () => { void saveRotoFrame(null); }, onSavePendingRotoFrames: savePendingRotoFrames, onSavePlay: savePlay, onUpdatePlayOptions: updateSelectedPlayOptions, onFrameCountChange: updatePlayFrameCount, onPlayPreview: playPreview, onStopPreview: stopPreview, onPreviewPlayFrame: previewLocalPlayFrame,
        onNavigateToSyncedFrame: (frame) => { void requestRotoFrameNavigation(frame); }, onGoToFirstFrame: goToFirstFrame, onGoToPreviousFrame: goToPreviousFrame, onGoToNextFrame: goToNextFrame, onGoToLastFrame: goToLastFrame, onInspectPlayFrame: previewLocalPlayFrame, onOnionChange: setOnion, onConvertPlayToRoto: convertPlayToRoto, onConvertRotoToPlay: convertRotoToPlay,
      }}
      status={{ rotoClosePromptState, rotoClosePromptMessage, shortcutsVisible }}
      actions={{ closeWithoutSavingRotoFrame, cancelRotoClose, saveAndCloseRotoFrame }}
    />
  );
}

function findAdjacentSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[], currentFrame: number, direction: -1 | 1): number | null {
  const sorted = markers
    .filter((marker) => marker.saved !== false)
    .map((marker) => marker.frame)
    .sort((a, b) => a - b);
  if (direction < 0) {
    return [...sorted].reverse().find((frame) => frame < currentFrame) ?? null;
  }
  return sorted.find((frame) => frame > currentFrame) ?? null;
}
