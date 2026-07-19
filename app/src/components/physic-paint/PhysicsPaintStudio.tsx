import { useCallback, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample, SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../types/physicPaint';
import { physicPaintStore } from '../../stores/physicPaintStore';
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState } from './view/physicsPaintWorkflowPresentation';
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
import { claimRotoSelectedFrame } from './roto/rotoKeyTransactions';
import { applyRotoKeyUtilityTransactionToLocalState, buildRotoKeyMoveTransaction, resolveRotoKeyMoveTiming, type RotoKeyMoveTransaction } from './roto/physicsPaintRotoKeyController';
import { useRotoKeyMoveHistory, type RotoKeyMoveHistoryIdentity, type RotoKeyMoveSnapshot } from './hooks/useRotoKeyMoveHistory';
import { buildPhysicsPaintRotoFrameCells } from './view/PhysicsPaintWorkflowStrip';
import { useRotoScriptLibraryController } from './hooks/useRotoScriptLibraryController';
import { useRotoPlayScriptController } from './hooks/useRotoPlayScriptController';
import { createRotoScriptThumbnail } from './roto/physicsPaintRotoScriptThumbnail';
import './physicsPaintStudio.css';
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

function cloneRotoValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneRotoFrameMap<T>(frames: ReadonlyMap<number, T>): Map<number, T> {
  return new Map([...frames].map(([frame, value]) => [frame, cloneRotoValue(value)]));
}

function getRotoFrameSource(frame: PhysicPaintRotoCacheFrame): number {
  return frame.sourceFrame ?? frame.appFrame;
}

function cloneRotoInterpolationSettings(settings: PhysicPaintRotoInterpolationSettings): PhysicPaintRotoInterpolationSettings {
  return {
    ...settings,
    segmentSpacingOverrides: settings.segmentSpacingOverrides?.map((override) => ({ ...override })) ?? [],
  };
}

function remapRotoOwnedSet(values: ReadonlySet<number>, transaction: RotoKeyMoveTransaction): Set<number> {
  const next = new Set(values);
  const original = new Set(values);
  for (const frame of [...transaction.removedFrames, ...transaction.cleanup.generatedFrames, ...transaction.cleanup.referenceFrames, ...transaction.cleanup.backgroundOnlySupportFrames, ...transaction.cleanup.deletedFrames]) next.delete(frame);
  for (const mapping of transaction.frameMappings) {
    next.delete(mapping.fromFrame);
    if (original.has(mapping.fromFrame)) next.add(mapping.toFrame);
  }
  return next;
}

function remapRotoOwnedCounts(values: ReadonlyMap<number, number>, transaction: RotoKeyMoveTransaction): Map<number, number> {
  const next = new Map(values);
  const original = new Map(values);
  for (const frame of [...transaction.removedFrames, ...transaction.cleanup.generatedFrames, ...transaction.cleanup.referenceFrames, ...transaction.cleanup.backgroundOnlySupportFrames, ...transaction.cleanup.deletedFrames]) next.delete(frame);
  for (const mapping of transaction.frameMappings) {
    next.delete(mapping.fromFrame);
    const count = original.get(mapping.fromFrame);
    if (count !== undefined) next.set(mapping.toFrame, count);
  }
  return next;
}

function remapRotoEditableFrames(frames: readonly number[], transaction: RotoKeyMoveTransaction): number[] {
  const next = remapRotoOwnedSet(new Set(frames), transaction);
  return [...next].sort((left, right) => left - right);
}

function buildRotoHistoryReplayTransaction(input: {
  currentFrames: readonly PhysicPaintRotoCacheFrame[];
  currentSettings: PhysicPaintRotoInterpolationSettings;
  target: RotoKeyMoveSnapshot<SerializedProject>;
  label: string;
}): RotoKeyMoveTransaction | null {
  const currentRealFrames = input.currentFrames.filter((frame) => frame.source === 'real-key');
  const currentSources = new Set(currentRealFrames.map(getRotoFrameSource));
  const targetSources = new Set(input.target.realKeyFrames.map(getRotoFrameSource));
  const removedSources = [...currentSources].filter((frame) => !targetSources.has(frame));
  const addedSources = [...targetSources].filter((frame) => !currentSources.has(frame));
  if (removedSources.length !== 1 || addedSources.length !== 1) return null;
  const sourceFrame = removedSources[0];
  const destinationSourceFrame = addedSources[0];
  const currentProjection = selectRotoTimelineView({ cachedRotoFrames: currentRealFrames, interpolationSettings: input.currentSettings, currentFrame: 0 }).projection;
  const targetProjection = selectRotoTimelineView({ cachedRotoFrames: input.target.realKeyFrames, interpolationSettings: input.target.interpolationSettings, currentFrame: 0 }).projection;
  const sourceDisplayFrame = currentProjection.realKeys.find((frame) => frame.sourceFrame === sourceFrame)?.displayFrame;
  const destinationDisplayFrame = targetProjection.realKeys.find((frame) => frame.sourceFrame === destinationSourceFrame)?.displayFrame;
  if (sourceDisplayFrame === undefined || destinationDisplayFrame === undefined) return null;
  const frameMapping = { fromFrame: sourceFrame, toFrame: destinationSourceFrame, mode: 'move' as const };
  return {
    operation: 'move',
    sourceDisplayFrame,
    requestedDestinationDisplayFrame: destinationDisplayFrame,
    destinationDisplayFrame,
    sourceFrame,
    destinationSourceFrame,
    realKeyFrames: input.target.realKeyFrames.map((frame) => cloneRotoValue(frame)),
    realKeyFrameNumbers: [...targetSources].sort((left, right) => left - right),
    removedFrames: [sourceFrame],
    changedFrames: [sourceFrame, destinationSourceFrame],
    activeFrame: destinationDisplayFrame,
    activeRestore: { kind: 'load-real-key', frame: destinationDisplayFrame },
    cleanup: { generatedFrames: [], referenceFrames: [], backgroundOnlySupportFrames: [], deletedFrames: [sourceFrame] },
    frameMappings: [frameMapping],
    segmentSpacingOverrides: input.target.interpolationSettings.segmentSpacingOverrides?.map((override) => ({ ...override })) ?? [],
    interpolationSettings: cloneRotoInterpolationSettings(input.target.interpolationSettings),
    successMessage: input.label,
  };
}

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
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(launchContext?.cachedRotoFrames ?? []);
  const rotoMoveInFlightRef = useRef(false);
  const rotoMoveGuardRef = useRef({ ready: false, keyActionInFlight: false, navigationLocked: false, scriptLibraryBusy: false, playScriptBusy: false, applyStatus: 'idle' as ApplyStatus });
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      launchContextRef.current = next;
      if (next?.cachedRotoFrames !== current?.cachedRotoFrames) latestRotoFramesRef.current = next?.cachedRotoFrames ?? [];
      return next;
    });
  }, []);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const bridgeModeRef = useRef(bridgeMode);
  bridgeModeRef.current = bridgeMode;
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
  const rotoEditableFramesRef = useRef<number[]>(rotoEditBuffer.editableFrames);
  rotoEditableFramesRef.current = rotoEditBuffer.editableFrames;
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const confirmedCachedRotoFramesRef = rotoPersistence.confirmedFramesRef;
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const pendingFrameSyncRef = useRef<number | null>(null);
  const resetRotoNavigationForLaunchRef = useRef<() => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current({ clearClipboard: false });
  }, []);
  const {
    activeOperationIdRef,
    pendingApplyRef,
    registerPendingApply,
    registerMoveSettlement,
    settleMoveTransportFailure,
    cancelMoveForLaunchReplacement,
    disposeMoveSettlement,
    matchApplyResult,
    startApplyTimeout,
  } = useRotoApplyLifecycle({
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
  const previewFps = launchContext?.fps && launchContext.fps > 0 ? launchContext.fps : 12;
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
    selectionKind: currentFrameSelectionKind,
    layerId: launchContext?.layerId ?? null,
    sourceFrame: currentFrameSelectionKind === 'real-key'
      ? (currentFrameOwnerSourceFrame ?? currentFrame)
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
      await rotoPersistence.flushLivePixels(currentFrameOwnerSourceFrame ?? currentFrame);
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
  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    keyUtilities: {
      currentFrame,
      canvasSize: { width: canvasWidth, height: canvasHeight },
      realKeyFrames: selectProjectedRealCachedRotoFrames(latestRotoFramesRef.current, rotoTimelineModel.view.value.projection),
      cachedRotoFrames: latestRotoFramesRef.current,
      dirtyFrames: dirtyRotoFramesRef.current,
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
      initialFps: previewFps,
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
  const rotoPlayScript = useRotoPlayScriptController({
    library: rotoScriptLibrary,
    getLaunchContext: () => launchContext,
    getSelection: () => ({ kind: currentFrameSelectionKind, sourceFrame: currentFrameOwnerSourceFrame ?? currentFrame, displayFrame: currentFrame }),
    getMotion: () => launchContext ? {
      deformation: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).deform,
      position: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).position,
    } : { deformation: 0, position: 0 },
    getBackground: () => buildRotoBackgroundMetadata(settings),
    getOperationLocked: () => rotoScript.mutationLocked.peek() || rotoScriptNavigationLocked,
    getSize: () => ({ width: canvasWidth, height: canvasHeight }),
    mirrorAccepted: (frames, firstSourceFrame, rotoBackground) => {
      if (!launchContext) return;
      physicPaintStore.replaceRotoKeyFrames({ kind: 'replace-roto-key-frames', operationId: `mirror-${crypto.randomUUID()}`, layerId: launchContext.layerId, startFrame: firstSourceFrame, frames, rotoBackground, rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) });
      const refreshed = physicPaintStore.getRotoCacheFrames(launchContext.layerId);
      latestRotoFramesRef.current = refreshed;
      setLaunchContext((current) => current ? { ...current, startFrame: firstSourceFrame, cachedRotoFrames: refreshed, rotoBackground } : current);
    },
    stopPlayback: rotoCachedPlayback.stop,
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
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
  const playScriptPhase = rotoPlayScript.phase.value;
  rotoMoveGuardRef.current = {
    ready: readyToApply,
    keyActionInFlight: rotoKeyUtilities.keyActionInFlight || rotoSession.actionAvailability.value.busy,
    navigationLocked: rotoScriptNavigationLocked,
    scriptLibraryBusy: rotoScriptLibrary.busy.value,
    playScriptBusy: playScriptPhase === 'preparing' || playScriptPhase === 'rendering' || playScriptPhase === 'committing' || playScriptPhase === 'regenerating',
    applyStatus,
  };
  const removeCachedRotoFrameFromLaunchContext = rotoPersistence.removeCachedFrame;
  const clearActiveSource = useCallback(() => {
    if (rotoScript.mutationLocked.peek() || !engine || !launchContext) return;
    if (rotoFrameEditing.clearCurrentFrame()) rotoScript.notifySourceRevision();
  }, [engine, launchContext, rotoFrameEditing, rotoScript]);
  const dryPaint = useCallback(() => {
    if (rotoScript.mutationLocked.peek()) return;
    engine?.forceDry();
  }, [engine, rotoScript]);
  const rotoMovePersistence = useRotoPersistenceIntegration({
    action: { bridgeMode, registerPendingApply, registerMoveSettlement, settleMoveTransportFailure, startApplyTimeout },
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
  const captureRotoMoveSnapshot = useCallback((
    identity: RotoKeyMoveHistoryIdentity,
    selectedSourceFrame: number,
    selectedDisplayFrame: number,
    referenceOverride?: { url: string | null; repaintBase: RenderedFramePayload | null },
  ): RotoKeyMoveSnapshot<SerializedProject> => {
    const current = launchContextRef.current;
    if (!current || current.layerId !== identity.layerId || current.operationId !== identity.launchOperationId) {
      throw new Error('The Physics Paint launch changed before the Roto key move snapshot could be captured.');
    }
    const cachedRotoFrames = latestRotoFramesRef.current.map((frame) => cloneRotoValue(frame));
    const buffer = rotoEditBuffer.bufferRef.current;
    return {
      identity,
      realKeyFrames: cachedRotoFrames.filter((frame) => frame.source === 'real-key'),
      cachedRotoFrames,
      interpolationSettings: cloneRotoInterpolationSettings(physicPaintStore.getRotoInterpolationSettings(identity.layerId)),
      frameStates: cloneRotoFrameMap(buffer.frameStates),
      previewFrames: cloneRotoFrameMap(buffer.previewFrames),
      capturedFrames: cloneRotoFrameMap(buffer.capturedFrames),
      dirtyFrames: new Set(buffer.dirtyFrames),
      liveOverlayActionCounts: new Map(buffer.liveOverlayActionCounts),
      editableFrames: [...rotoEditableFramesRef.current],
      selectedSourceFrame,
      selectedDisplayFrame,
      engineState: engineRef.current?.save() ?? null,
      cachedReferenceUrl: referenceOverride?.url ?? cachedRotoReferenceUrlRef.current,
      cachedRepaintBaseFrame: cloneRotoValue(referenceOverride?.repaintBase ?? cachedRotoRepaintBaseFrameRef.current),
    };
  }, [engineRef, rotoEditBuffer.bufferRef]);

  const restoreRotoSnapshotState = useCallback((
    snapshot: RotoKeyMoveSnapshot<SerializedProject>,
    restoreCanvas: boolean,
  ) => {
    const current = launchContextRef.current;
    if (!current || current.layerId !== snapshot.identity.layerId || current.operationId !== snapshot.identity.launchOperationId) return false;
    const restoredFrames = snapshot.cachedRotoFrames.map((frame) => cloneRotoValue(frame));
    latestRotoFramesRef.current = restoredFrames;
    confirmedCachedRotoFramesRef.current = new Map(restoredFrames.filter((frame) => frame.source === 'real-key').map((frame) => [getRotoFrameSource(frame), frame]));
    const buffer = rotoEditBuffer.bufferRef.current;
    rotoEditBuffer.replaceFrameStates(cloneRotoFrameMap(snapshot.frameStates));
    rotoEditBuffer.replacePreviewFrames(cloneRotoFrameMap(snapshot.previewFrames));
    rotoEditBuffer.replaceDirtyFrames(new Set(snapshot.dirtyFrames));
    buffer.capturedFrames = cloneRotoFrameMap(snapshot.capturedFrames);
    buffer.liveOverlayActionCounts = new Map(snapshot.liveOverlayActionCounts);
    const editableFrames = [...snapshot.editableFrames];
    rotoEditableFramesRef.current = editableFrames;
    rotoEditBuffer.setEditableFrameList(() => editableFrames);
    const referenceUrl = snapshot.cachedReferenceUrl;
    const repaintBase = snapshot.cachedRepaintBaseFrame ? cloneRotoValue(snapshot.cachedRepaintBaseFrame) : null;
    cachedRotoReferenceUrlRef.current = referenceUrl;
    cachedRotoRepaintBaseFrameRef.current = repaintBase;
    if (restoreCanvas && engineRef.current) {
      const selectedFrame = restoredFrames.find((frame) => frame.source === 'real-key' && getRotoFrameSource(frame) === snapshot.selectedSourceFrame) ?? null;
      const currentState = engineRef.current.save();
      const engineAlreadyMatches = snapshot.engineState !== null && JSON.stringify(currentState) === JSON.stringify(snapshot.engineState);
      if (!engineAlreadyMatches) {
        loadCachedRotoReferenceFrame(snapshot.selectedDisplayFrame, engineRef.current as PreviewBackgroundEngine, selectedFrame);
        if (snapshot.engineState) engineRef.current.load(cloneRotoValue(snapshot.engineState));
      }
    }
    setCachedRotoReferenceUrl(referenceUrl);
    setCachedRotoRepaintBaseFrame(repaintBase);
    setLaunchContext((latest) => {
      if (!latest || latest.layerId !== snapshot.identity.layerId || latest.operationId !== snapshot.identity.launchOperationId) return latest;
      return {
        ...latest,
        startFrame: snapshot.selectedDisplayFrame,
        cachedRotoFrames: restoredFrames,
        rotoInterpolationSettings: cloneRotoInterpolationSettings(snapshot.interpolationSettings),
      };
    });
    return true;
  }, [engineRef, loadCachedRotoReferenceFrame, rotoEditBuffer, setCachedRotoReferenceUrl, setCachedRotoRepaintBaseFrame, setLaunchContext]);

  const rollbackRotoMoveSnapshot = useCallback((snapshot: RotoKeyMoveSnapshot<SerializedProject>) => {
    const current = launchContextRef.current;
    if (!current || current.layerId !== snapshot.identity.layerId || current.operationId !== snapshot.identity.launchOperationId) return false;
    rotoMovePersistence.replaceRotoKeyMoveLocal({
      activeFrame: snapshot.selectedDisplayFrame,
      realKeyFrames: snapshot.realKeyFrames,
      interpolationSettings: snapshot.interpolationSettings,
    }, snapshot.identity);
    return restoreRotoSnapshotState(snapshot, true);
  }, [restoreRotoSnapshotState, rotoMovePersistence]);

  const applyRotoMoveOwnership = useCallback((transaction: RotoKeyMoveTransaction) => {
    const buffer = rotoEditBuffer.bufferRef.current;
    const mapped = applyRotoKeyUtilityTransactionToLocalState({
      editableStates: buffer.frameStates,
      previewFrames: buffer.previewFrames,
      transaction,
    });
    const mappedCaptured = applyRotoKeyUtilityTransactionToLocalState({
      editableStates: new Map<number, never>(),
      previewFrames: buffer.capturedFrames,
      transaction,
    });
    rotoEditBuffer.replaceFrameStates(mapped.editableStates);
    rotoEditBuffer.replacePreviewFrames(mapped.previewFrames as Map<number, RenderedFramePayload>);
    rotoEditBuffer.replaceDirtyFrames(remapRotoOwnedSet(buffer.dirtyFrames, transaction));
    buffer.capturedFrames = mappedCaptured.previewFrames as Map<number, RenderedFramePayload>;
    buffer.liveOverlayActionCounts = remapRotoOwnedCounts(buffer.liveOverlayActionCounts, transaction);
    const editableFrames = remapRotoEditableFrames(rotoEditableFramesRef.current, transaction);
    rotoEditableFramesRef.current = editableFrames;
    rotoEditBuffer.setEditableFrameList(() => editableFrames);
    const mapping = transaction.frameMappings[0];
    const currentBase = cachedRotoRepaintBaseFrameRef.current;
    const nextBase = currentBase && getRotoFrameSource(currentBase as PhysicPaintRotoCacheFrame) === mapping.fromFrame
      ? { ...currentBase, appFrame: mapping.toFrame, sourceFrame: mapping.toFrame, displayFrame: transaction.destinationDisplayFrame }
      : currentBase;
    cachedRotoRepaintBaseFrameRef.current = nextBase;
    setCachedRotoRepaintBaseFrame(nextBase);
    return { url: cachedRotoReferenceUrlRef.current, repaintBase: nextBase };
  }, [rotoEditBuffer, setCachedRotoRepaintBaseFrame]);

  const finalizeAcceptedRotoMove = useCallback((
    identity: RotoKeyMoveHistoryIdentity,
    transaction: RotoKeyMoveTransaction,
    referenceState: { url: string | null; repaintBase: RenderedFramePayload | null },
  ) => {
    const current = launchContextRef.current;
    if (!current || current.layerId !== identity.layerId || current.operationId !== identity.launchOperationId) return false;
    const refreshedFrames = latestRotoFramesRef.current;
    const movedFrame = refreshedFrames.find((frame) => frame.source === 'real-key' && getRotoFrameSource(frame) === transaction.destinationSourceFrame) ?? null;
    const selectedWasSource = current.startFrame === transaction.sourceDisplayFrame;
    if (!selectedWasSource && engineRef.current) {
      loadCachedRotoReferenceFrame(transaction.destinationDisplayFrame, engineRef.current as PreviewBackgroundEngine, movedFrame);
    }
    const repaintBase = referenceState.repaintBase && getRotoFrameSource(referenceState.repaintBase as PhysicPaintRotoCacheFrame) === transaction.destinationSourceFrame
      ? movedFrame ?? referenceState.repaintBase
      : referenceState.repaintBase;
    cachedRotoReferenceUrlRef.current = referenceState.url;
    cachedRotoRepaintBaseFrameRef.current = repaintBase;
    setCachedRotoReferenceUrl(referenceState.url);
    setCachedRotoRepaintBaseFrame(repaintBase);
    setLaunchContext((latest) => {
      if (!latest || latest.layerId !== identity.layerId || latest.operationId !== identity.launchOperationId) return latest;
      return { ...latest, startFrame: transaction.destinationDisplayFrame, cachedRotoFrames: refreshedFrames };
    });
    setApplyStatus('success');
    setApplyMessage(transaction.successMessage);
    setLastError(null);
    rotoScript.notifySourceRevision();
    return true;
  }, [engineRef, loadCachedRotoReferenceFrame, rotoScript, setCachedRotoReferenceUrl, setCachedRotoRepaintBaseFrame, setLaunchContext]);

  const replayRotoMoveSnapshot = useCallback(async (snapshot: RotoKeyMoveSnapshot<SerializedProject>, label: string): Promise<boolean> => {
    const current = launchContextRef.current;
    if (!current || current.layerId !== snapshot.identity.layerId || current.operationId !== snapshot.identity.launchOperationId || bridgeModeRef.current === 'Unavailable') return false;
    const currentSettings = physicPaintStore.getRotoInterpolationSettings(current.layerId);
    const currentFrames = physicPaintStore.getRotoCacheFrames(current.layerId);
    const transaction = buildRotoHistoryReplayTransaction({ currentFrames, currentSettings, target: snapshot, label });
    if (!transaction) return false;
    const currentView = selectRotoTimelineView({ cachedRotoFrames: currentFrames, interpolationSettings: currentSettings, currentFrame: current.startFrame });
    const currentSnapshot = captureRotoMoveSnapshot(
      snapshot.identity,
      currentView.currentFrameOwnerSourceFrame ?? current.startFrame,
      current.startFrame,
    );
    rotoCachedPlayback.stop();
    restoreRotoSnapshotState(snapshot, false);
    let settled = false;
    try {
      const accepted = await rotoMovePersistence.commitRotoKeyMove({
        identity: snapshot.identity,
        transaction,
        onSettlement: async (outcome) => {
          settled = true;
          if (outcome.type === 'accepted') {
            if (!restoreRotoSnapshotState(snapshot, true)) throw new Error('The Physics Paint launch changed before Roto move history could finish.');
            setApplyStatus('success');
            setApplyMessage(label);
            setLastError(null);
            rotoScript.notifySourceRevision();
            return;
          }
          if (outcome.type === 'failed') {
            rollbackRotoMoveSnapshot(currentSnapshot);
            setApplyStatus('error');
            setApplyMessage('Could not replay the Roto key move. The previous key state was restored.');
          }
        },
      });
      if (!accepted && !settled) rollbackRotoMoveSnapshot(currentSnapshot);
      return accepted;
    } catch (error) {
      rollbackRotoMoveSnapshot(currentSnapshot);
      const message = error instanceof Error ? error.message : 'Could not replay the Roto key move.';
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return false;
    }
  }, [captureRotoMoveSnapshot, restoreRotoSnapshotState, rollbackRotoMoveSnapshot, rotoCachedPlayback, rotoMovePersistence, rotoScript]);

  const rotoMoveHistory = useRotoKeyMoveHistory<SerializedProject>({
    identity: launchContext ? { launchOperationId: launchContext.operationId, layerId: launchContext.layerId } : null,
    availability: historyAvailability,
    replaySnapshot: replayRotoMoveSnapshot,
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

  const moveRotoKey = useCallback(async (fromDisplayFrame: number, toDisplayFrame: number): Promise<number | null> => {
    const expectedLaunch = launchContextRef.current;
    if (!expectedLaunch || rotoMoveInFlightRef.current || rotoMoveHistory.busyRef.current) return null;
    const initialFrames = physicPaintStore.getRotoCacheFrames(expectedLaunch.layerId);
    const initialSettings = physicPaintStore.getRotoInterpolationSettings(expectedLaunch.layerId);
    const initialView = selectRotoTimelineView({ cachedRotoFrames: initialFrames, interpolationSettings: initialSettings, currentFrame: expectedLaunch.startFrame });
    const initialSource = initialView.projection.realKeys.find((frame) => frame.displayFrame === fromDisplayFrame);
    if (!initialSource || !resolveRotoKeyMoveTiming({
      fromDisplayFrame,
      toDisplayFrame,
      sourceFrame: initialSource.sourceFrame,
      realSourceFrames: selectRealCachedRotoSourceFrameNumbers(initialFrames),
      interpolationSettings: initialSettings,
    }).valid) return null;

    const identity = { launchOperationId: expectedLaunch.operationId, layerId: expectedLaunch.layerId };
    let rollbackSnapshot: RotoKeyMoveSnapshot<SerializedProject> | null = null;
    let localOwnershipApplied = false;
    rotoMoveInFlightRef.current = true;
    rotoCachedPlayback.stop();
    try {
      const barrierSourceFrame = initialView.currentFrameOwnerSourceFrame ?? expectedLaunch.startFrame;
      engineRef.current?.flushPendingStrokeFinalizations();
      await rotoPersistence.flushLivePixels(barrierSourceFrame);

      const current = launchContextRef.current;
      const guards = rotoMoveGuardRef.current;
      if (!current || current.layerId !== identity.layerId || current.operationId !== identity.launchOperationId) return null;
      if (!engineRef.current || bridgeModeRef.current === 'Unavailable' || guards.applyStatus === 'applying' || guards.keyActionInFlight || guards.navigationLocked || guards.scriptLibraryBusy || guards.playScriptBusy || rotoScript.mutationLocked.peek() || activeOperationIdRef.current !== null || pendingApplyRef.current !== null) return null;
      const latestFrames = physicPaintStore.getRotoCacheFrames(identity.layerId);
      const interpolationSettings = physicPaintStore.getRotoInterpolationSettings(identity.layerId);
      const latestView = selectRotoTimelineView({ cachedRotoFrames: latestFrames, interpolationSettings, currentFrame: current.startFrame });
      const expandedCurrentFrame = latestView.projection.realKeys.find((frame) => frame.sourceFrame === current.startFrame)?.displayFrame ?? current.startFrame;
      const visibleFrames = buildPhysicsPaintRotoFrameCells(expandedCurrentFrame);
      if (!visibleFrames.includes(fromDisplayFrame) || !visibleFrames.includes(toDisplayFrame) || rotoEditBuffer.bufferRef.current.dirtyFrames.size > 0) return null;
      const sourceCell = latestView.projection.realKeys.find((frame) => frame.displayFrame === fromDisplayFrame);
      if (!sourceCell || sourceCell.displayFrame === toDisplayFrame) return null;
      const authoritativeTiming = resolveRotoKeyMoveTiming({
        fromDisplayFrame,
        toDisplayFrame,
        sourceFrame: sourceCell.sourceFrame,
        realSourceFrames: selectRealCachedRotoSourceFrameNumbers(latestFrames),
        interpolationSettings,
      });
      if (!authoritativeTiming.valid) return null;
      const transaction = buildRotoKeyMoveTransaction({
        fromDisplayFrame,
        toDisplayFrame,
        sourceFrame: sourceCell.sourceFrame,
        realKeyFrames: latestFrames.filter((frame) => frame.source === 'real-key'),
        cachedRotoFrames: latestFrames,
        interpolationSettings,
        canvasSize: { width: canvasWidth, height: canvasHeight },
      });
      const before = captureRotoMoveSnapshot(
        identity,
        latestView.currentFrameOwnerSourceFrame ?? current.startFrame,
        current.startFrame,
      );
      rollbackSnapshot = before;
      const referenceState = applyRotoMoveOwnership(transaction);
      localOwnershipApplied = true;
      let settled = false;
      const accepted = await rotoMovePersistence.commitRotoKeyMove({
        identity,
        transaction,
        onSettlement: async (outcome) => {
          settled = true;
          if (outcome.type === 'accepted') {
            if (!finalizeAcceptedRotoMove(identity, transaction, referenceState)) throw new Error('The Physics Paint launch changed before the Roto key move could finish.');
            const after = captureRotoMoveSnapshot(identity, transaction.destinationSourceFrame, transaction.destinationDisplayFrame);
            rotoMoveHistory.recordAcceptedMove(before, after);
            return;
          }
          if (outcome.type === 'failed') {
            rollbackRotoMoveSnapshot(before);
            const message = outcome.reason === 'timeout'
              ? 'Roto key move timed out. The original key was restored.'
              : outcome.reason === 'parent-rejection'
                ? outcome.detail?.error ?? 'The parent rejected the Roto key move. The original key was restored.'
                : 'Could not send the Roto key move. The original key was restored.';
            setApplyStatus('error');
            setApplyMessage(message);
            setLastError(message);
          }
        },
      });
      if (!accepted && !settled) rollbackRotoMoveSnapshot(before);
      return accepted ? transaction.destinationDisplayFrame : null;
    } catch (error) {
      if (localOwnershipApplied && rollbackSnapshot) rollbackRotoMoveSnapshot(rollbackSnapshot);
      const message = error instanceof Error ? error.message : 'Could not move the Roto key.';
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    } finally {
      rotoMoveInFlightRef.current = false;
    }
  }, [activeOperationIdRef, applyRotoMoveOwnership, canvasHeight, canvasWidth, captureRotoMoveSnapshot, engineRef, finalizeAcceptedRotoMove, pendingApplyRef, rollbackRotoMoveSnapshot, rotoCachedPlayback, rotoEditBuffer.bufferRef, rotoMoveHistory, rotoMovePersistence, rotoPersistence, rotoScript]);

  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    engineRef,
    lifecycle: {
      pendingFrameSyncRef,
      pendingApplyRef,
      activeOperationIdRef,
      prepareScriptLaunchReplacement: rotoScript.prepareLaunchReplacement,
      completeScriptLaunchReplacement: rotoScript.completeLaunchReplacement,
      cancelMoveForLaunchReplacement,
      disposeMoveSettlement,
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
  usePhysicsPaintApplyResultController({
    bridgeMode,
    general: { matchApplyResult, pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, setApplyStatus, setApplyMessage, setLastError },
  });
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: { currentFrame, isPlaying, mutationLocked },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
      deleteRotoKey: rotoKeyUtilities.deleteKey,
      toggleShortcuts: () => setShortcutsVisible((visible) => !visible),
      toggleRotoPlayback: rotoCachedPlayback.toggle,
      navigateRotoFrame: (frame) => { void requestRotoFrameNavigation(frame); },
      toggleOnion: () => setOnion((current) => ({ ...current, enabled: !current.enabled })),
      adjustOnionCount: (delta) => setOnion((current) => ({ ...current, count: clampOnionCount(current.count + delta) })),
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
    framesToApply: 1,
    savedFrames: timelineSavedRotoFrames,
    playFrames: [],
  });
  const { goToFirstFrame, goToPreviousFrame, goToNextFrame, goToLastFrame } = rotoNavigationActions;
  const rotoMotion = launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : null;
  const panelMotion = rotoMotion ? { strokeDeformation: rotoMotion.deform, strokePosition: rotoMotion.position } : { strokeDeformation: 0, strokePosition: 0 };
  const updatePanelMotion = (motion: { strokeDeformation: number; strokePosition: number }) => { void updateRotoInterpolationSettings({ deform: motion.strokeDeformation, position: motion.strokePosition }); };
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
        onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled }), onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount }),
        onDuplicateRotoKey: duplicateRotoKey, onInsertRotoFrame: insertRotoFrame, onDeleteRotoFrame: deleteRotoFrame, onCopyRotoFrame: copyRotoFrame, onPasteRotoFrame: pasteRotoFrame, onMoveRotoKey: moveRotoKey, rotoDragContextKey: launchContext ? `${launchContext.layerId}:${launchContext.operationId}` : 'none', hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        rotoScript, onCopyRotoScript: () => { void rotoScript.copyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onApplyRotoScript: () => { void rotoScript.applyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); }, onDiscardRotoScript: () => { rotoScript.discardScript(); setLastError(null); },
        statusMessage: isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying,
        onNavigateToSyncedFrame: (frame) => { void requestRotoFrameNavigation(frame); }, onGoToFirstFrame: goToFirstFrame, onGoToPreviousFrame: goToPreviousFrame, onGoToNextFrame: goToNextFrame, onGoToLastFrame: goToLastFrame, onOnionChange: setOnion,
      },
    status: { shortcutsVisible },
  });
  return <PhysicsPaintStudioView {...viewModel} />;
}
