import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample, SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { physicPaintStore, physicPaintVersion } from '../../stores/physicPaintStore';
import { buildPhysicPaintRotoPhysicalRevision, PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, type PhysicPaintRotoInterpolationState, type PhysicPaintRotoRealKeyRecord } from './roto/physicsPaintRotoPhysicalModel';
import { rebuildRotoPhysicalOwnership } from './roto/rotoPhysicalOwnership';
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState } from './view/physicsPaintWorkflowPresentation';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectRealCachedRotoSourceFrameNumbers } from './roto/rotoTimelineSelectors';
import { useRotoNavigationCoordinator } from './hooks/useRotoNavigationCoordinator';
import { useRotoFramePersistenceCoordinator } from './hooks/useRotoFramePersistenceCoordinator';
import { useRotoFrameEditingController } from './hooks/useRotoFrameEditingController';
import { useRotoPhysicalEditCoordinator } from './hooks/useRotoPhysicalEditCoordinator';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './engine/physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './engine/usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './engine/usePhysicsPaintEngineActions';
import { useRotoBackgroundMetadataSync } from './hooks/useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './roto/rotoOnionPreview';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './view/physicsPaintStudioSelectors';
import { buildRotoBackgroundMetadata, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './engine/physicsPaintStudioSettings';
import { parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { createPhysicPaintThumbnailNativeEncoder, sendPhysicPaintApplyPayload, sendPhysicPaintFrameSyncMessage } from './bridge/physicsPaintBridgeTransport';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintBridgeMode, usePhysicsPaintCloseFlush } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from './performance/physicsPaintPerformanceTrace';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoInterpolationController } from './hooks/useRotoInterpolationController';
import { useRotoScriptClipboardController } from './hooks/useRotoScriptClipboardController';
import { claimRotoSelectedFrame } from './roto/physicsPaintRotoKeyController';
import { useRotoPhysicalEditHistory } from './hooks/useRotoPhysicalEditHistory';
import { useRotoScriptLibraryController } from './hooks/useRotoScriptLibraryController';
import { useRotoPlayScriptController } from './hooks/useRotoPlayScriptController';
import { createRotoScriptThumbnail } from './roto/physicsPaintRotoScriptThumbnail';
import './physicsPaintStudio.css';
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

export function PhysicsPaintStudio() {
  const profilePerformance = isPhysicsPaintProfilingEnabled();
  const recordEnginePerformance = profilePerformance
    ? (sample: PaintPerformanceSample) => recordPhysicsPaintPerformance(sample)
    : undefined;
  const [isPlaying, setIsPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [animTotal, setAnimTotal] = useState(0);
  const [launchContext, setLaunchContextState] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const launchContextRef = useRef<PhysicPaintLaunchContext | null>(launchContext);
  launchContextRef.current = launchContext;
  const selectedKeyId = useSignal<string | null>(launchContext?.rotoPhysical?.selectedKeyId ?? null);
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(launchContext?.cachedRotoFrames ?? []);
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      launchContextRef.current = next;
      if (next?.cachedRotoFrames !== current?.cachedRotoFrames) latestRotoFramesRef.current = next?.cachedRotoFrames ?? [];
      if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {
        selectedKeyId.value = next?.rotoPhysical?.selectedKeyId ?? null;
      } else if (next && next.startFrame !== current?.startFrame) {
        selectedKeyId.value = physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, next.startFrame)?.keyId ?? null;
        physicPaintStore.setRotoPhysicalSelection(next.layerId, selectedKeyId.value, next.startFrame);
      }
      return next;
    });
  }, []);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const bridgeModeRef = useRef(bridgeMode);
  bridgeModeRef.current = bridgeMode;
  // Physical selection state (D-01/D-10): selectedKeyId is the stable real-key
  // identity, rotoKeyRecords and rotoInterpolationState are derived from the
  // store's validated physical records and enabled-only interpolation state.
  const rotoKeyRecords = useMemo(() => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId) : [], [launchContext?.layerId, physicPaintVersion.value]);
  const rotoInterpolationState = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalInterpolationState(launchContext.layerId) : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, [launchContext?.layerId, physicPaintVersion.value]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialPhysicsPaintStudioSettings());
  const workflowMode = 'roto' as const;
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
  const resetRotoKeySessionRef = useRef<(options?: { clearClipboard?: boolean }) => void>(() => {});
  const rotoPersistence = useRotoFramePersistenceCoordinator({
    workflowMode,
    backgroundMode: settings.background,
    launchContext,
    latestFramesRef: latestRotoFramesRef,
    setLaunchContext,
    store: {
      getRotoPhysicalDocument: (layerId) => physicPaintStore.getRotoPhysicalDocument(layerId),
      getRotoPhysicalContentRevision: (layerId) => physicPaintStore.getRotoPhysicalContentRevision(layerId),
      getRotoRealKeyRecord: (layerId, keyId) => physicPaintStore.getRotoRealKeyRecord(layerId, keyId),
      getRotoRealKeyRecordByAppFrame: (layerId, appFrame) => physicPaintStore.getRotoRealKeyRecordByAppFrame(layerId, appFrame),
      getRotoPhysicalRenderSource: (layerId, appFrame) => physicPaintStore.getRotoPhysicalRenderSource(layerId, appFrame),
      updateRotoPhysicalRealKeyPayload: (layerId, keyId, revision, payload, diagnostics) => physicPaintStore.updateRotoPhysicalRealKeyPayload(layerId, keyId, revision, payload, diagnostics),
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
  const rotoEditableFramesRef = useRef<number[]>(rotoEditBuffer.editableFrames);
  rotoEditableFramesRef.current = rotoEditBuffer.editableFrames;
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const pendingFrameSyncRef = useRef<number | null>(null);
  const resetRotoNavigationForLaunchRef = useRef<() => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current({ clearClipboard: false });
  }, []);
  const physicalEditCoordinatorRouteRef = useRef<{ consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => 'ignore' | 'mismatch' | 'accepted' } | null>(null);
  const applyResultController = usePhysicsPaintApplyResultController({
    bridgeMode,
    general: { pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, setApplyStatus, setApplyMessage, setLastError },
    physicalEditCoordinator: { consumeBridgeApplyResult: (detail) => physicalEditCoordinatorRouteRef.current!.consumeBridgeApplyResult(detail) },
    timeout: {
      onTimeout: (message) => {
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
        pendingRotoKeyActionMessageRef.current = null;
      },
    },
  });
  const {
    activeOperationIdRef,
    pendingApplyRef,
  } = applyResultController;
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
  const previewFps = launchContext?.fps && launchContext.fps > 0 ? launchContext.fps : 12;
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: latestRotoFramesRef.current,
    interpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
    currentFrame,
    rotoKeyRecords,
    rotoInterpolationState,
    capacity: launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId) : 1,
    selectedKeyId: selectedKeyId.value,
  });
  const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value;
  const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value;
  const timelineCachedRotoFrames = rotoTimelineModel.cachedRotoFrames.value;
  const currentPhysicalCell = rotoTimelineModel.currentCell.value;
  const currentFrameSelectionKind = currentPhysicalCell.kind === 'real'
    ? 'real-key' as const
    : currentPhysicalCell.kind === 'generated'
      ? 'generated-interpolation' as const
      : 'empty' as const;
  const currentFrameIsGeneratedRoto = workflowMode === 'roto' && currentFrameSelectionKind === 'generated-interpolation';
  const [rotoScriptNavigationLocked, setRotoScriptNavigationLocked] = useState(false);
  const { cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, setCachedRotoReferenceUrl, setCachedRotoRepaintBaseFrame, clearCachedRotoReferenceUrl, resetCachedRotoReference, findCachedRotoDisplayFrame, loadCachedRotoReferenceFrame } = rotoPersistence.reference;
  const cachedRotoReferenceUrlRef = useRef(cachedRotoReferenceUrl);
  const cachedRotoRepaintBaseFrameRef = useRef(cachedRotoRepaintBaseFrame);
  cachedRotoReferenceUrlRef.current = cachedRotoReferenceUrl;
  cachedRotoRepaintBaseFrameRef.current = cachedRotoRepaintBaseFrame;
  const rotoScript = useRotoScriptClipboardController({
    getEngine: () => engineRef.current,
    getSource: () => ({
      selectionKind: currentFrameSelectionKind,
      layerId: launchContext?.layerId ?? null,
      sourceFrame: currentFrameSelectionKind === 'real-key'
        ? (currentFrame)
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
    selectionKind: currentFrameSelectionKind,
    layerId: launchContext?.layerId ?? null,
    sourceFrame: currentFrameSelectionKind === 'real-key'
      ? (currentFrame)
      : currentFrame,
    displayFrame: currentFrame,
  });
  const rotoScriptLibrary = useRotoScriptLibraryController({
    request: async () => { throw new Error('Bridge request adapter is installed by the library hook.'); },
    capturePersistence: rotoScript.captureScriptForPersistence,
    captureThumbnail: async (scriptAlphaCanvas) => {
      const currentBridgeMode = bridgeMode === 'Unavailable' ? await detectPhysicsPaintBridgeMode() : bridgeMode;
      return createRotoScriptThumbnail({
        scriptAlphaCanvas,
        sourceWidth: projectCanvasWidth,
        sourceHeight: projectCanvasHeight,
        background: buildRotoBackgroundMetadata(settings),
        ...(currentBridgeMode === 'Tauri' ? { nativeEncoder: createPhysicPaintThumbnailNativeEncoder() } : {}),
      });
    },
    replaceClipboard: rotoScript.replaceClipboardFromPersisted,
    getLaunchContext: () => launchContext,
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
  usePhysicsPaintCloseFlush(
    () => workflowMode === 'roto' && Boolean(engineRef.current?.getStrokeCount() || rotoPersistence.hasPendingLivePixels()),
    async () => {
      if (workflowMode !== 'roto') return;
      engineRef.current?.flushPendingStrokeFinalizations();
      await rotoPersistence.flushLivePixels(currentFrame);
    },
  );
  const mutationLocked = rotoScript.mutationLocked.value;
  const handleScriptRowActivate = useCallback(async (id: string) => {
    await rotoScriptLibrary.activateAndLoad(id);
  }, [rotoScriptLibrary]);
  const handleSelectedScriptLoadAndApply = useCallback(async () => {
    const selectedId = rotoScriptLibrary.selectedId.peek();
    if (!selectedId) return;
    const preparation = rotoScript.prepareScriptLoadAndApply();
    if (!preparation) return;
    try {
      const loaded = await rotoScriptLibrary.activateAndLoad(selectedId, preparation);
      if (!loaded) return;
      const applied = await rotoScript.applyPreparedScript(preparation);
      if (applied) setLastError(null);
      else {
        const message = rotoScript.error.peek()?.message;
        if (message) setLastError(message);
      }
    } finally {
      rotoScript.cancelPreparedScriptLoadAndApply(preparation);
    }
  }, [rotoScript, rotoScriptLibrary]);
  const scriptLoadAndApplyDisabledReason = !rotoScriptLibrary.selected.value
    ? 'Select a project script first.'
    : rotoScriptLibrary.busy.value
      ? 'Finish the current script library operation.'
      : rotoScript.availability.value.replacementApplyDisabledReason;
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
  const replacePhysicalRecordsWithOwnership = (
    layerId: string,
    records: readonly PhysicPaintRotoRealKeyRecord[],
    interpolation: PhysicPaintRotoInterpolationState,
  ) => {
    const beforeRecords = physicPaintStore.getRotoRealKeyRecords(layerId);
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(records, interpolation);
    if (buildPhysicPaintRotoPhysicalRevision(beforeRecords, physicPaintStore.getRotoPhysicalInterpolationState(layerId)) === nextRevision) {
      return physicPaintStore.replaceRotoPhysicalRecords(layerId, records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId));
    }
    const ownership = rebuildRotoPhysicalOwnership({
      beforeRecords,
      afterRecords: records,
      contentRevision: nextRevision,
      snapshot: {
        frameStates: rotoEditBuffer.bufferRef.current.frameStates,
        previewFrames: rotoEditBuffer.bufferRef.current.previewFrames,
        capturedFrames: rotoEditBuffer.bufferRef.current.capturedFrames,
        confirmedFrames: rotoPersistence.confirmedFramesRef.current,
        dirtyFrames: rotoEditBuffer.bufferRef.current.dirtyFrames,
        liveOverlayActionCounts: rotoEditBuffer.bufferRef.current.liveOverlayActionCounts,
        editableFrames: rotoEditableFramesRef.current,
        reference: { url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: cachedRotoRepaintBaseFrameRef.current },
      },
    });
    if (!ownership.ok) return { ok: false as const, error: ownership.error };
    const result = physicPaintStore.replaceRotoPhysicalRecords(layerId, records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId));
    if (!result.ok) return result;
    const next = ownership.value;
    rotoEditBuffer.replaceFrameStates(next.frameStates);
    rotoEditBuffer.replacePreviewFrames(next.previewFrames);
    rotoEditBuffer.bufferRef.current.capturedFrames = next.capturedFrames;
    rotoEditBuffer.replaceDirtyFrames(next.dirtyFrames);
    rotoEditBuffer.bufferRef.current.liveOverlayActionCounts = next.liveOverlayActionCounts;
    rotoEditableFramesRef.current = next.editableFrames;
    rotoEditBuffer.setEditableFrameList(() => next.editableFrames);
    rotoPersistence.confirmedFramesRef.current = next.confirmedFrames;
    cachedRotoReferenceUrlRef.current = next.reference.url;
    cachedRotoRepaintBaseFrameRef.current = next.reference.cachedRepaintBase;
    setCachedRotoReferenceUrl(next.reference.url);
    setCachedRotoRepaintBaseFrame(next.reference.cachedRepaintBase);
    return result;
  };
  const physicalEditCoordinator = useRotoPhysicalEditCoordinator<SerializedProject>({
    engine,
    records: {
      getRecords: (layerId) => physicPaintStore.getRotoRealKeyRecords(layerId),
      getInterpolation: (layerId) => physicPaintStore.getRotoPhysicalInterpolationState(layerId),
      getCapacity: (layerId) => physicPaintStore.getRotoPhysicalCapacity(layerId),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    buffer: {
      get frameStates() { return rotoEditBuffer.bufferRef.current.frameStates; },
      get previewFrames() { return rotoEditBuffer.bufferRef.current.previewFrames; },
      get capturedFrames() { return rotoEditBuffer.bufferRef.current.capturedFrames; },
      get dirtyFrames() { return rotoEditBuffer.bufferRef.current.dirtyFrames; },
      get liveOverlayActionCounts() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; },
      get editableFrames() { return rotoEditableFramesRef.current; },
      replaceFrameStates: (frames) => { rotoEditBuffer.replaceFrameStates(frames as Map<number, SerializedProject>); },
      replacePreviewFrames: (frames) => { rotoEditBuffer.replacePreviewFrames(frames as Map<number, RenderedFramePayload>); },
      replaceCapturedFrames: (frames) => { rotoEditBuffer.bufferRef.current.capturedFrames = frames as Map<number, RenderedFramePayload>; },
      replaceDirtyFrames: (frames) => { rotoEditBuffer.replaceDirtyFrames(new Set(frames)); },
      replaceLiveOverlayActionCounts: (counts) => { rotoEditBuffer.bufferRef.current.liveOverlayActionCounts = new Map(counts); },
      setEditableFrameList: (frames) => { rotoEditableFramesRef.current = [...frames]; rotoEditBuffer.setEditableFrameList(() => [...frames]); },
    },
    selection: {
      getSelectedKeyId: () => selectedKeyId.value,
      setSelectedKeyId: (keyId) => { selectedKeyId.value = keyId; },
      getCurrentAppFrame: () => currentFrame,
      setCurrentAppFrame: (frame) => {
        const launch = launchContextRef.current;
        if (launch) physicPaintStore.setRotoPhysicalSelection(launch.layerId, selectedKeyId.value, frame);
        setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
      },
    },
    reference: {
      getCachedReference: () => ({ url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: cachedRotoRepaintBaseFrameRef.current }),
      setCachedReference: (reference) => {
        cachedRotoReferenceUrlRef.current = reference.url;
        cachedRotoRepaintBaseFrameRef.current = reference.cachedRepaintBase;
        setCachedRotoReferenceUrl(reference.url);
        setCachedRotoRepaintBaseFrame(reference.cachedRepaintBase);
      },
    },
    engineState: {
      saveEngineState: () => engineRef.current?.save() ?? null,
      loadEngineState: (state) => { engineRef.current?.load(state); },
    },
    launch: {
      getLaunchContext: () => launchContextRef.current,
      setLaunchContextStartFrame: (frame) => { setLaunchContext((current) => current ? { ...current, startFrame: frame } : current); },
      setLaunchContextCachedFrames: () => { rotoPersistence.syncCurrentPhysicalDocument(); },
    },
    paint: {
      flushPendingStrokeFinalizations: () => { engineRef.current?.flushPendingStrokeFinalizations(); },
      flushLivePixels: (sourceFrame) => rotoPersistence.flushLivePixels(sourceFrame),
    },
    bridge: {
      getBridgeMode: () => bridgeModeRef.current,
      sendPhysicalEditPayload: async (payload) => { await sendPhysicPaintApplyPayload(payload, bridgeModeRef.current); },
    },
    settlement: {
      registerPendingSettlement: () => {},
      clearPendingSettlement: () => {},
    },
    status: {
      setApplyStatus,
      setConciseMessage: (message) => { setApplyMessage(message); },
      setLastError,
      logDiagnostic: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
    },
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
    getRotoKeyRecords: () => rotoKeyRecords,
    getRotoInterpolationState: () => rotoInterpolationState,
    getPhysicalCells: () => rotoTimelineModel.physicalCells.value,
    getSelectedKeyId: () => selectedKeyId.value,
    getCurrentAppFrame: () => currentFrame,
    getLaunchContext: () => launchContextRef.current,
    getCapacity: () => launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId) : 1,
    executePhysicalEdit: (executeInput) => physicalEditCoordinator.executePhysicalEdit(executeInput),
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    publishStatus: (message) => { setApplyMessage(message); },
  });
  const rotoPhysicalActions = rotoTimelineActions.physicalActions;

  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    keyUtilities: {
      currentFrame,
      currentKeyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      physicalKeyUtilities: rotoTimelineActions.physicalKeyUtilities,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      realKeyFrames: rotoKeyRecords.map((record): PhysicPaintRotoCacheFrame => ({
        ...record.payload,
        source: 'real-key',
      })),
      cachedRotoFrames: latestRotoFramesRef.current,
      dirtyFrames: dirtyRotoFramesRef.current,
      applyStatus,
      flushInFlight: false,
      buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
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
      initialFps: previewFps,
      getProjection: () => launchContext ? physicPaintStore.getRotoPhysicalProjection(launchContext.layerId) : null,
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
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;
  const rotoCachedPlayback = rotoNavigation.playback;
  const rotoPlayScript = useRotoPlayScriptController({
    library: rotoScriptLibrary,
    getLaunchContext: () => launchContext,
    getSelection: () => ({
      kind: currentFrameSelectionKind,
      keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      appFrame: currentFrame,
    }),
    getMotion: () => launchContext ? {
      deformation: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).deform,
      position: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).position,
    } : { deformation: 0, position: 0 },
    getBackground: () => buildRotoBackgroundMetadata(settings),
    getOperationLocked: () => rotoScript.mutationLocked.peek() || rotoScriptNavigationLocked,
    getSize: () => ({ width: canvasWidth, height: canvasHeight }),
    mirrorAccepted: (frames, firstAppFrame, rotoBackground) => {
      if (!launchContext) return;
      physicPaintStore.replaceRotoKeyFrames({ kind: 'replace-roto-key-frames', operationId: `mirror-${crypto.randomUUID()}`, layerId: launchContext.layerId, startFrame: firstAppFrame, frames, rotoBackground, rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) });
      const refreshed = physicPaintStore.getRotoCacheFrames(launchContext.layerId);
      latestRotoFramesRef.current = refreshed;
      setLaunchContext((current) => current ? { ...current, startFrame: firstAppFrame, cachedRotoFrames: refreshed, rotoBackground } : current);
    },
    stopPlayback: rotoCachedPlayback.stop,
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
  resetRotoKeySessionRef.current = rotoKeyUtilities.resetSession;
  resetRotoNavigationForLaunchRef.current = rotoNavigation.resetForLaunch;
  const rotoFrameEditing = useRotoFrameEditingController({
    workflowMode, currentFrame, currentFrameSelectionKind,
    canvasSize: { width: canvasWidth, height: canvasHeight }, engine, launchContext,
    selectedKeyId: selectedKeyId.value,
    selectedRealKey: rotoTimelineModel.selectedRealKey.value,
    currentCell: rotoTimelineModel.currentCell.value,
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
  const beginRotoFrameEdit = rotoFrameEditing.beginFrameEdit;
  acceptRotoScriptBrushRef.current = rotoFrameEditing.acceptScriptBrush;
  useRotoBackgroundMetadataSync({ launchContext, settings });
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
  const clearActiveSource = useCallback(() => {
    if (rotoScript.mutationLocked.peek() || !engine || !launchContext) return;
    if (rotoFrameEditing.clearCurrentFrame()) rotoScript.notifySourceRevision();
  }, [engine, launchContext, rotoFrameEditing, rotoScript]);
  const dryPaint = useCallback(() => {
    if (rotoScript.mutationLocked.peek()) return;
    engine?.forceDry();
  }, [engine, rotoScript]);
  const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    rotoCachedPlayback.stop();
    if (launchContext) {
      engine?.flushPendingStrokeFinalizations();
      try {
        await rotoPersistence.flushLivePixels(currentFrame);
      } catch {
        setApplyStatus('error');
        setApplyMessage(`Could not save Roto frame ${currentFrame} before navigation.`);
        return false;
      }
      setCachedRotoReferenceUrl(null);
      if (engine) {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    if (launchContext) {
      const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, frame);
      selectedKeyId.value = selectedRecord?.keyId ?? null;
      physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, selectedKeyId.value, frame);
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    pendingFrameSyncRef.current = frame;
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, currentFrame, engine, launchContext, loadCachedRotoReferenceFrame, rotoCachedPlayback, rotoPersistence, setLaunchContext]);
  rotoNavigation.configureRuntimePort({ navigateToSyncedFrame: navigateToSyncedPhysicalFrame });
  rotoNavigation.configureDisplayPort({
    restoreFrame: (effect) => {
      const frame = effect.restore.frame;
      setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
      if (engine && (effect.restore.kind === 'load-real-key' || effect.restore.kind === 'blank-real-key')) loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      else if (engine && effect.restore.kind === 'clear-blank') {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
    },
    clearCanvas: (frame) => {
      if (!engine || frame !== currentFrame) return;
      engine.clearPreviewBaseImage();
      (engine as PreviewBackgroundEngine).resetBackground();
      engine.clear();
    },
    navigate: navigateToSyncedPhysicalFrame,
    clearCachedReferenceFrame: rotoPersistence.removeCachedFrame,
  });
  const rotoMoveHistory = useRotoPhysicalEditHistory<SerializedProject>({
    identity: launchContext ? { launchOperationId: launchContext.operationId, layerId: launchContext.layerId } : null,
    availability: historyAvailability,
    coordinator: {
      executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
      pendingOperationId: physicalEditCoordinator.pendingOperationId,
      acceptedOutput: physicalEditCoordinator.acceptedOutput,
    },
    recordsPort: {
      getRecords: (layerId) => physicPaintStore.getRotoRealKeyRecords(layerId),
      getInterpolation: (layerId) => physicPaintStore.getRotoPhysicalInterpolationState(layerId),
      getCapacity: (layerId) => physicPaintStore.getRotoPhysicalCapacity(layerId),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    undoPaint: rotoFrameEditing.undo,
    redoPaint: rotoFrameEditing.redo,
  });

  const undo = useCallback(async () => {
    const changed = await rotoMoveHistory.undo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistory, rotoScript]);
  const redo = useCallback(async () => {
    const changed = await rotoMoveHistory.redo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistory, rotoScript]);

  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    engineRef,
    lifecycle: {
      pendingFrameSyncRef,
      pendingApplyRef,
      activeOperationIdRef,
      prepareScriptLaunchReplacement: rotoScript.prepareLaunchReplacement,
      completeScriptLaunchReplacement: rotoScript.completeLaunchReplacement,
      cancelPhysicalEditForLaunch: () => { physicalEditCoordinator.cancelPhysicalEdit('launch-replacement'); },
      disposePhysicalEditSettlement: () => { physicalEditCoordinator.cancelPhysicalEdit('disposal'); },
    },
    state: {
      setLaunchContext, setSettings, setApplyStatus, setApplyMessage, setLastError,
    },
    resetPersistenceForLaunch: rotoPersistence.resetForLaunch,
    resetNavigationForLaunchRef: resetRotoNavigationForLaunchRef,
    resetCachedReference: resetCachedRotoReference,
    loadCachedReferenceFrame: (frame, readyEngine) => { loadCachedRotoReferenceFrame(frame, readyEngine ?? null); },
    onSettledLaunchContext: () => { void rotoScriptLibrary.updateProjectContext(); },
  });
  const { saveEditableState, loadEditableState, exportDebugProof } = usePhysicsPaintWorkflowIntegration({
    session: {
      engine, canvasSize: { width: canvasWidth, height: canvasHeight }, launchContext, currentFrame,
      setLaunchContext, setApplyStatus, setApplyMessage, setLastError,
      isMutationLocked: () => rotoScript.mutationLocked.peek(),
    },
  });
  physicalEditCoordinatorRouteRef.current = {
    consumeBridgeApplyResult: (detail) => physicalEditCoordinator.consumeBridgeApplyResult(detail),
  };
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: { currentFrame, isPlaying, mutationLocked },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
      deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,
      toggleShortcuts: () => setShortcutsVisible((visible) => !visible),
      toggleRotoPlayback: rotoCachedPlayback.toggle,
      navigateRotoFrame: (frame) => { void requestRotoFrameNavigation(frame); },
      toggleOnion: () => setOnion((current) => ({ ...current, enabled: !current.enabled })),
      adjustOnionCount: (delta) => setOnion((current) => ({ ...current, count: clampOnionCount(current.count + delta) })),
    },
  });
  const onionPreviewFrames = projectRotoOnionPreviewFrames({
    currentFrame,
    isPlaying,
    onion,
    realKeyRecords: rotoKeyRecords,
    getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, appFrame) : null,
    previewFrames: rotoPreviewFramesRef.current,
    dirtyFrames: dirtyRotoFramesRef.current,
  });
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: getRotoCachedPlaybackFrames(),
  });
  const { updateRotoInterpolationSettings } = useRotoInterpolationController({
    launchContext, bridgeMode,
    setRotoPhysicalInterpolationState: (layerId, state) => physicPaintStore.setRotoPhysicalInterpolationState(layerId, state),
    getRotoPhysicalInterpolationState: (layerId) => physicPaintStore.getRotoPhysicalInterpolationState(layerId),
    getRotoKeyRecords: (layerId) => physicPaintStore.getRotoRealKeyRecords(layerId),
    sendApplyPayload: sendPhysicPaintApplyPayload,
    setApplyStatus, setApplyMessage, setLastError, setPlaybackStatus: rotoCachedPlayback.setStatus,
    isMutationLocked: () => rotoScript.mutationLocked.peek(),
  });
  const rotoNavigationActions = rotoNavigation.createNavigationActions({
    currentFrame,
    framesToApply: 1,
    savedFrames: timelineSavedRotoFrames,
    playFrames: [],
  });
  const { goToFirstFrame, goToPreviousFrame, goToNextFrame, goToLastFrame } = rotoNavigationActions;
  const rotoMotion = launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : null;
  const panelMotion = rotoMotion ? { strokeDeformation: rotoMotion.deform, strokePosition: rotoMotion.position } : { strokeDeformation: 0, strokePosition: 0 };
  // Script Motion (D-04): deform/position remain a separate store/controller
  // contract, never merged into interpolation enabled state.
  const updatePanelMotion = (motion: { strokeDeformation: number; strokePosition: number }) => {
    if (!launchContext) return;
    const current = physicPaintStore.getRotoInterpolationSettings(launchContext.layerId);
    physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, { ...current, deform: motion.strokeDeformation, position: motion.strokePosition });
  };
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
        cachedRotoReferenceUrl,
        cachedRotoPlaybackUrl: rotoCachedPlayback.frame?.dataUrl ?? null,
        cachedRotoPlaybackActive: rotoCachedPlayback.isActive,
        cachedRotoPlaybackComposition: launchContext?.rotoBackground ? { width: projectCanvasWidth, height: projectCanvasHeight, background: launchContext.rotoBackground } : null,
        inputDisabled: rotoInputDisabled,
        inputDisabledMessage: currentFrameIsGeneratedRoto
          ? `Generated frame ${currentFrame} is render-only.`
          : mutationLocked
            ? 'Finish the current Roto script operation.'
            : undefined,
        onInputIntent: beginRotoFrameEdit,
        onionOverlay: onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
          <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={frame.dataUrl} style={{ opacity: getOnionFrameOpacity(frame.distance, onion.opacity) }} alt="" />
        )) : null,
        canvasKey,
        mount: {
          width: canvasWidth, height: canvasHeight, paperTextureScale,
          onEngineReady: (readyEngine) => {
            readyEngine.setHistoryAvailabilityListener((availability) => {
              rotoMoveHistory.reconcilePaintBarriers(availability);
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
            rotoMoveHistory.observePaintMutation(mutationId, kind);
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
            const appFrame = acceptedTarget?.displayFrame ?? emptyTarget?.displayFrame ?? currentFrame;
            const physicalRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, appFrame);
            if (!physicalRecord) return;
            const cachedBaseAppFrame = cachedRotoRepaintBaseFrame?.appFrame ?? null;
            if (isEmpty) {
              if (cachedRotoRepaintBaseFrame && cachedBaseAppFrame === appFrame) {
                rotoPersistence.invalidateLivePixels(appFrame);
                rotoPersistence.upsertCachedFrame(cachedRotoRepaintBaseFrame, false);
              } else {
                rotoPersistence.removeCachedFrame(appFrame);
              }
              return;
            }
            const snapshotStartedAt = profilePerformance ? performance.now() : 0;
            const liveAlphaCanvas = mutationEngine.copyLiveAlphaCanvas();
            const capturedBase = publicationIdentity?.cachedBase ?? null;
            const capturedBaseAppFrame = capturedBase?.appFrame ?? null;
            const cachedBase = publicationIdentity
              ? capturedBaseAppFrame === appFrame ? capturedBase : null
              : cachedBaseAppFrame === appFrame ? cachedRotoRepaintBaseFrame : null;
            const capture = rotoPersistence.captureLivePixels({
              layerId: publicationIdentity?.layerId ?? launchContext.layerId,
              operationId: publicationIdentity?.operationId,
              keyId: physicalRecord.keyId,
              appFrame,
              liveAlphaCanvas,
              cachedBase,
              background: publicationIdentity?.background,
              size: { width: canvasWidth, height: canvasHeight },
              mutationId,
              interpolationSettings: acceptedTarget?.interpolationSettings ?? emptyTarget?.interpolationSettings,
            });
            if (profilePerformance) recordPhysicsPaintPerformance({ stage: 'snapshot-handoff', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAt, timestamp: performance.now(), mutationId, sourceFrame: appFrame });
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
        scripts: {
          library: rotoScriptLibrary,
          playScript: rotoPlayScript,
          loadAndApplyDisabledReason: scriptLoadAndApplyDisabledReason,
          onSave: () => { void rotoScriptLibrary.saveActiveFrame(); },
          onActivateRow: (id) => { void handleScriptRowActivate(id); },
          onLoadAndApply: () => { void handleSelectedScriptLoadAndApply(); },
          onRefresh: () => { void rotoScriptLibrary.refresh(); },
        },
      },
    workflow: {
        workflowLabel: launchContext?.workflowLabel,
        currentFrame, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames,
        keyActionInFlight: rotoKeyUtilities.keyActionInFlight || rotoScriptNavigationLocked, mutationLocked, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: rotoCachedPlayback.setLoop, onRotoPlaybackFpsChange: rotoCachedPlayback.updateFps, rotoInterpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
        onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled }),
        onDuplicateRotoKey: duplicateRotoKey, onInsertRotoFrame: rotoPhysicalActions.insertRotoFrame, onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame, rotoPhysicalActions, onCopyRotoFrame: copyRotoFrame, onPasteRotoFrame: pasteRotoFrame, rotoKeyRecords, rotoPhysicalCells: rotoTimelineModel.physicalCells.value, rotoDragContextKey: launchContext ? `${launchContext.layerId}:${launchContext.operationId}` : 'none', hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        rotoScript, onCopyRotoScript: () => { void rotoScript.copyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onApplyRotoScript: () => { void rotoScript.applyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onDiscardRotoScript: () => { rotoScript.discardScript(); setLastError(null); },
        statusMessage: isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying,
        onNavigateToSyncedFrame: (frame) => { void requestRotoFrameNavigation(frame); }, onGoToFirstFrame: goToFirstFrame, onGoToPreviousFrame: goToPreviousFrame, onGoToNextFrame: goToNextFrame, onGoToLastFrame: goToLastFrame, onOnionChange: setOnion,
      },
    status: { shortcutsVisible },
  });
  return <PhysicsPaintStudioView {...viewModel} />;
}
