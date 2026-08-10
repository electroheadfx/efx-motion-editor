import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { CompletedPaintMutation, EfxPaintEngine, PaintHistoryAvailability, PaintPerformanceSample, SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame, PhysicPaintRotoPlaybackSettings } from '../../types/physicPaint';
import { physicPaintStore, physicPaintVersion } from '../../stores/physicPaintStore';
import { buildPhysicPaintRotoPhysicalRevision, PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, type PhysicPaintRotoInterpolationState, type PhysicPaintRotoRealKeyRecord } from './roto/physicsPaintRotoPhysicalModel';
import { rebuildRotoPhysicalOwnership } from './roto/rotoPhysicalOwnership';
import { selectAllRotoKeyIds, collapseRotoKeySelection, toggleRotoKeySelection, extendRotoKeySelectionRange, resolvePostAcceptanceRotoSelection } from './roto/physicsPaintRotoMultiSelection';
import {
  extendPhysicsPaintRotoSpacingProxyRange,
  reconcilePhysicsPaintRotoLoopClipSelection,
  reconcilePhysicsPaintRotoSpacingSelection,
  selectPhysicsPaintRotoSpacingProxyPlain,
  togglePhysicsPaintRotoSpacingProxy,
  updatePhysicsPaintRotoLoopClipSelection,
  type PhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingSelection,
  type PhysicsPaintRotoSpacingSelectionGesture,
} from './roto/physicsPaintRotoSpacingSelection';
import { paintStore } from '../../stores/paintStore';
import { clampOnionCount, type PhysicsPaintOnionState } from './view/physicsPaintWorkflowPresentation';
import { PhysicsPaintStudioView } from './view/PhysicsPaintStudioView';
import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard';
import { createIdentityMemo, usePhysicsPaintStudioViewModel } from './hooks/usePhysicsPaintStudioViewModel';
import { useRotoTimelineActions } from './hooks/useRotoTimelineActions';
import { useRotoTimelineModel } from './hooks/useRotoTimelineModel';
import { selectRealCachedRotoSourceFrameNumbers } from './roto/rotoTimelineSelectors';
import { useRotoNavigationCoordinator } from './hooks/useRotoNavigationCoordinator';
import { useRotoFramePersistenceCoordinator } from './hooks/useRotoFramePersistenceCoordinator';
import { useRotoFrameEditingController } from './hooks/useRotoFrameEditingController';
import { useRotoPhysicalEditCoordinator, type RotoPhysicalEditCoordinatorExecuteInput } from './hooks/useRotoPhysicalEditCoordinator';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize } from './engine/physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './engine/usePhysicsPaintEngineLifecycle';
import { usePhysicsPaintEngineActions } from './engine/usePhysicsPaintEngineActions';
import { useRotoBackgroundMetadataSync } from './hooks/useRotoBackgroundMetadataSync';
import { getOnionFrameOpacity, projectRotoOnionPreviewFrames } from './roto/rotoOnionPreview';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './view/physicsPaintStudioSelectors';
import { projectPhysicsPaintLoopClipPresentation } from './view/physicsPaintLoopClipPresentation';
import { buildRotoBackgroundMetadata, makeInitialPhysicsPaintStudioSettings, type PhysicsPaintStudioSettings } from './engine/physicsPaintStudioSettings';
import { parsePhysicsPaintLaunchContext } from './bridge/physicsPaintLaunchContext';
import { createPhysicPaintThumbnailNativeEncoder, sendPhysicPaintApplyPayload, sendPhysicPaintAudioOwnership, sendPhysicPaintFrameSyncMessage } from './bridge/physicsPaintBridgeTransport';
import { efxPaintAudioOwnership } from './audio/efxPaintAudioOwnership';
import { efxPaintAudioMonitor } from './audio/efxPaintAudioMonitor';
import { audioPreviewEnabled, setAudioPreviewEnabled } from './audio/efxPaintAudioPreviewStore';
import { buildBlankRotoFrame, type RenderedFramePayload } from './roto/rotoCanvasFrames';
import { detectPhysicsPaintBridgeMode, usePhysicsPaintBridgeMode, usePhysicsPaintCloseFlush } from './bridge/usePhysicsPaintParentBridge';
import { usePhysicsPaintLaunchIntegration } from './hooks/usePhysicsPaintLaunchIntegration';
import { usePhysicsPaintApplyResultController } from './hooks/usePhysicsPaintApplyResultController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance, recordPhysicsPaintPerformanceCounter } from './performance/physicsPaintPerformanceTrace';
import { usePhysicsPaintWorkflowIntegration } from './hooks/usePhysicsPaintWorkflowIntegration';
import { useRotoInterpolationController } from './hooks/useRotoInterpolationController';
import { useRotoPlaybackSettingsController } from './hooks/useRotoPlaybackSettingsController';
import { useRotoScriptClipboardController } from './hooks/useRotoScriptClipboardController';
import type { RotoScriptPhysicalTarget, RotoScriptSourceSnapshot } from './roto/physicsPaintRotoScriptClipboard';
import { useRotoPhysicalEditHistory } from './hooks/useRotoPhysicalEditHistory';
import { useRotoScriptLibraryController } from './hooks/useRotoScriptLibraryController';
import { createRotoNavigationGeneration, createRotoUiFlushScheduler } from './hooks/rotoUiFlushScheduler';
import { useRotoPlayScriptController } from './hooks/useRotoPlayScriptController';
import { createRotoScriptThumbnail } from './roto/physicsPaintRotoScriptThumbnail';
import './physicsPaintStudio.css';
const DEFAULT_ONION_STATE: Omit<PhysicsPaintOnionState, 'opacity'> = { enabled: false, previous: true, next: false, count: 1 };
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

export function PhysicsPaintStudio() {
  recordPhysicsPaintPerformanceCounter('render.studio');
  const profilePerformance = isPhysicsPaintProfilingEnabled();
  const recordEnginePerformance = profilePerformance
    ? (sample: PaintPerformanceSample) => recordPhysicsPaintPerformance(sample)
    : undefined;
  const [isPlaying, setIsPlaying] = useState(false);
  // 38.1-D-01/D-08: the playback per-tick surface is signal-backed — written
  // by onStart/onFrame per tick and read ONLY via .peek() (statusMessage) or
  // by the narrow sanctioned live surfaces (playback canvas image, nav-pill
  // current-frame indicator). Never .value-read in the Studio render body or
  // the view-model literal: that would re-subscribe the whole Studio per tick.
  const rotoPlaybackFrameIndex = useSignal(0);
  const rotoPlaybackFrameCount = useSignal(0);
  const [launchContext, setLaunchContextState] = useState<PhysicPaintLaunchContext | null>(() => parsePhysicsPaintLaunchContext(window.location));
  const launchContextRef = useRef<PhysicPaintLaunchContext | null>(launchContext);
  launchContextRef.current = launchContext;
  const selectedKeyId = useSignal<string | null>(launchContext?.rotoPhysical?.selectedKeyId ?? null);
  const selectedLoopClipId = useSignal<string | null>(null);
  const selectedLoopClipIds = useSignal<readonly string[]>([]);
  const loopSelectionAnchorId = useSignal<string | null>(null);
  // Session-local multi-selection (Pattern 5; D-02/D-05): keyId-only, never
  // persisted, never sent across the bridge — only selectedKeyId persists.
  const selectedKeyIds = useSignal<readonly string[]>([]);
  const selectionAnchorKeyId = useSignal<string | null>(null);
  const rotoSpacingSelection = useSignal<PhysicsPaintRotoSpacingSelection | null>(null);
  const latestRotoFramesRef = useRef<PhysicPaintRotoCacheFrame[]>(launchContext?.cachedRotoFrames ?? []);
  const setLaunchContext = useCallback((update: PhysicPaintLaunchContext | null | ((current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null)) => {
    setLaunchContextState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      launchContextRef.current = next;
      if (next?.cachedRotoFrames !== current?.cachedRotoFrames) latestRotoFramesRef.current = next?.cachedRotoFrames ?? [];
      if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {
        selectedKeyId.value = next?.rotoPhysical?.selectedKeyId ?? null;
        // Launch replacement resets the multi-selection exactly like the
        // single selection (Pattern 5): a replaced launch never inherits a
        // stale set or anchor.
        selectedKeyIds.value = selectedKeyId.value === null ? [] : [selectedKeyId.value];
        selectionAnchorKeyId.value = selectedKeyId.value;
        rotoSpacingSelection.value = null;
        selectedLoopClipId.value = null;
        selectedLoopClipIds.value = [];
        loopSelectionAnchorId.value = null;
      } else if (next && next.startFrame !== current?.startFrame) {
        selectedKeyId.value = physicPaintStore.getRotoRealKeyRecordByAppFrame(next.layerId, next.startFrame)?.keyId ?? null;
        physicPaintStore.setRotoPhysicalSelection(next.layerId, selectedKeyId.value, next.startFrame);
        const spacingSelection = rotoSpacingSelection.peek();
        selectedKeyIds.value = spacingSelection?.selectedSourceKeyIds
          ?? (selectedKeyId.value === null ? [] : [selectedKeyId.value]);
        selectionAnchorKeyId.value = spacingSelection
          ? spacingSelection.sourceKeyIds[spacingSelection.anchorSourceIndex] ?? null
          : selectedKeyId.value;
      }
      return next;
    });
  }, []);
  // 38.1 D-04/D-05: one rAF UI flush scheduler and one navigation generation
  // counter per Studio instance (never module scope — two Studio windows must
  // not share navigation generations). The scheduler caps startFrame-driven
  // Studio renders at one per animation frame with latest-state-at-fire-time;
  // the generation counter skips canvas paints superseded by a newer
  // navigation while a never-superseded (discrete-click) generation always
  // paints. The mount-scoped cleanup revokes any pending rAF so an unmounted
  // Studio never flushes (external-sync disposal, not an effect chain).
  const rotoUiFlushScheduler = useMemo(() => createRotoUiFlushScheduler(), []);
  const rotoNavigationGeneration = useMemo(() => createRotoNavigationGeneration(), []);
  useEffect(() => () => { rotoUiFlushScheduler.dispose(); }, [rotoUiFlushScheduler]);
  // 38-11: per-Studio identity memos backing the memo-wrapped tool rail and
  // right panel (never module scope — two Studio windows must not share
  // caches). A startFrame-only Studio render feeds Object.is-identical deps,
  // resolve returns the cached props object, and preact/compat memo's default
  // shallow compare skips the subtree. Deps enumerate exactly the values each
  // build references — never the Studio's frame cursor.
  const layoutPropsMemo = useRef(createIdentityMemo()).current;
  const topBarPropsMemo = useRef(createIdentityMemo()).current;
  const toolRailPropsMemo = useRef(createIdentityMemo()).current;
  const rightPanelPropsMemo = useRef(createIdentityMemo()).current;
  const playScriptDialogPropsMemo = useRef(createIdentityMemo()).current;
  const canvasStackPropsMemo = useRef(createIdentityMemo()).current;
  const canvasMountPropsMemo = useRef(createIdentityMemo()).current;
  const scheduleRotoStartFramePropagation = useCallback((frame: number) => {
    rotoUiFlushScheduler.schedule(() => {
      setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    });
  }, [rotoUiFlushScheduler, setLaunchContext]);
  const bridgeMode = usePhysicsPaintBridgeMode();
  const bridgeModeRef = useRef(bridgeMode);
  bridgeModeRef.current = bridgeMode;
  // 41-04 (D-05): the audio ownership guard sends its claim/release events
  // through the dual-transport sender with the live bridge mode. The guard
  // module is transport-agnostic (session state only); this effect is the
  // single wiring point, cleaned up on Studio unmount.
  useEffect(() => {
    efxPaintAudioOwnership.configure({
      claimSender: (claim) => {
        void sendPhysicPaintAudioOwnership(claim, bridgeModeRef.current).catch((error) => {
          console.warn('[PhysicsPaintStudio] audio ownership event failed', error);
        });
      },
    });
    return () => efxPaintAudioOwnership.configure({ claimSender: null });
  }, []);
  // 41-04 (D-14): the Audio Preview toggle intent flips the session signal;
  // the immediate mid-playback effect (stop/resume at the live cursor) routes
  // through the monitor funnel inside setAudioPreviewEnabled.
  const handleAudioPreviewToggle = useCallback(() => {
    setAudioPreviewEnabled(!audioPreviewEnabled.peek());
  }, []);
  // Physical selection state (D-01/D-10): selectedKeyId is the stable real-key
  // identity, rotoKeyRecords and rotoInterpolationState are derived from the
  // store's validated physical records and canonical interpolation state.
  const rotoKeyRecords = useMemo(() => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId) : [], [launchContext?.layerId, physicPaintVersion.value]);
  const rotoIncomingInterpolationBreakKeyIds = useMemo(
    () => launchContext ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId) : [],
    [launchContext?.layerId, physicPaintVersion.value],
  );
  const rotoInterpolationState = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalInterpolationState(launchContext.layerId) : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED, [launchContext?.layerId, physicPaintVersion.value]);
  const rotoLoopClips = useMemo(() => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY, [launchContext?.layerId, physicPaintVersion.value]);
  const orderedRotoLoopClipIds = useMemo(() => [...rotoLoopClips]
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId))
    .map((loopClip) => loopClip.loopId), [rotoLoopClips]);
  const effectiveRotoLoopClipSelection = reconcilePhysicsPaintRotoLoopClipSelection(
    selectedLoopClipIds.value.length > 0 && loopSelectionAnchorId.value !== null && selectedLoopClipId.value !== null
      ? {
        selectedLoopClipIds: selectedLoopClipIds.value,
        anchorLoopClipId: loopSelectionAnchorId.value,
        primaryLoopClipId: selectedLoopClipId.value,
      }
      : null,
    orderedRotoLoopClipIds,
  );
  const effectiveSelectedLoopClipIds = effectiveRotoLoopClipSelection?.selectedLoopClipIds ?? [];
  const effectiveRotoSpacingSelection = reconcilePhysicsPaintRotoSpacingSelection(
    rotoSpacingSelection.value,
    rotoLoopClips
      .filter((loopClip) => loopClip.sourceKeyIds.every((keyId) => rotoKeyRecords.some((record) => record.keyId === keyId)))
      .map((loopClip) => ({ sourceKeyIds: loopClip.sourceKeyIds })),
  );
  // 38.1 D-07: the legacy interpolation settings read MUST be memoized on the
  // same structural inputs (physicPaintVersion + layerId) as the records
  // above — the store getter returns a fresh clone per call, and an unstable
  // identity here defeats the useRotoTimelineModel structural memo, forcing a
  // full signal-graph rebuild on every Studio render.
  const rotoLegacyInterpolationSettings = useMemo(() => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined, [launchContext?.layerId, physicPaintVersion.value]);
  const currentFrame = launchContext?.startFrame ?? 0;
  // Single Select All entry point (D-03): shared by the Cmd/Ctrl+A dispatcher
  // branch and the future strip icon (plan 37-04). Store-ordered real-key
  // identities guarantee physical-frame order and real-key-only membership.
  const selectAllRotoKeys = useCallback(() => {
    const orderedRealKeyIds = rotoKeyRecords.map((record) => record.keyId);
    if (orderedRealKeyIds.length === 0) return;
    selectedKeyId.value = null;
    if (launchContext) {
      physicPaintStore.setRotoPhysicalSelection(
        launchContext.layerId,
        null,
        currentFrame,
      );
    }
    const next = selectAllRotoKeyIds(
      orderedRealKeyIds,
      null,
    );
    rotoSpacingSelection.value = null;
    selectedLoopClipIds.value = [];
    loopSelectionAnchorId.value = null;
    selectedLoopClipId.value = null;
    selectedKeyIds.value = next.selectedKeyIds;
    selectionAnchorKeyId.value = next.anchorKeyId;
    // UI-SPEC status contract: one feedback line per successful invocation,
    // shared by the Cmd/Ctrl+A route and the 37-04 icon route through the
    // same setApplyMessage publisher the bundle's publishStatus uses (36.15
    // D-15 single-owner capsule arbitration). Selection-only gestures
    // (toggle/range/collapse) publish nothing.
    setApplyMessage('All keys selected');
  }, [currentFrame, launchContext, rotoKeyRecords]);
  const [, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialPhysicsPaintStudioSettings());
  const workflowMode = 'roto' as const;
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const handleSetRightPanelCollapsed = useCallback((collapsed: boolean) => {
    setRightPanelCollapsed(collapsed);
  }, []);
  const playButtonRef = useRef<HTMLButtonElement>(null);
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
  const resetRotoNavigationForLaunchRef = useRef<(settings: PhysicPaintRotoPlaybackSettings) => void>(() => {});
  const acceptRotoScriptBrushRef = useRef<() => void>(() => {});
  const prepareRotoScriptTargetRef = useRef<(source: RotoScriptSourceSnapshot) => Promise<RotoScriptPhysicalTarget | null>>(async () => null);
  const pendingFirstPaintTargetRef = useRef<{
    launchOperationId: string;
    layerId: string;
    appFrame: number;
    promise: Promise<RotoScriptPhysicalTarget | null>;
  } | null>(null);
  const syncPendingRotoFrames = useCallback(() => {
    resetRotoKeySessionRef.current({ clearClipboard: false });
  }, []);
  const physicalEditCoordinatorRouteRef = useRef<{ consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => 'ignore' | 'mismatch' | 'accepted' } | null>(null);
  const playbackSettingsRouteRef = useRef<{ consumeBridgeApplyResult: (detail: PhysicPaintApplyResult | null | undefined) => boolean } | null>(null);
  const applyResultController = usePhysicsPaintApplyResultController({
    bridgeMode,
    general: { pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef, setApplyStatus, setApplyMessage, setLastError },
    physicalEditCoordinator: { consumeBridgeApplyResult: (detail) => physicalEditCoordinatorRouteRef.current?.consumeBridgeApplyResult(detail) ?? 'ignore' },
    playbackSettings: { consumeBridgeApplyResult: (detail) => playbackSettingsRouteRef.current?.consumeBridgeApplyResult(detail) ?? false },
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
      pendingFirstPaintTargetRef.current = null;
    },
  });
  const previewFps = launchContext?.fps && launchContext.fps > 0 ? launchContext.fps : 12;
  const initialRotoPlaybackSettings = launchContext?.rotoPlayback ?? {
    loop: false,
    fps: Math.max(1, Math.min(60, previewFps)),
  };
  const rotoPhysicalCapacity = launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId) : 1;
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: latestRotoFramesRef.current,
    interpolationSettings: rotoLegacyInterpolationSettings,
    currentFrame,
    rotoKeyRecords,
    rotoInterpolationState,
    capacity: rotoPhysicalCapacity,
    selectedKeyId: selectedKeyId.value,
    incomingInterpolationBreakKeyIds: rotoIncomingInterpolationBreakKeyIds,
    rotoLoopClips,
    rotoParentEndExclusive: rotoPhysicalCapacity,
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
  const currentCellKeyId = currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null;
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
      keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      appFrame: currentFrame,
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
    prepareTarget: (source) => prepareRotoScriptTargetRef.current(source),
    flushSourcePublication: (appFrame) => rotoPersistence.flushLivePixels(appFrame),
    onFirstAcceptedBrush: () => acceptRotoScriptBrushRef.current(),
    setNavigationLocked: setRotoScriptNavigationLocked,
  });
  rotoScript.updateEngine(engineRef.current);
  rotoScript.updateSource({
    selectionKind: currentFrameSelectionKind,
    layerId: launchContext?.layerId ?? null,
    keyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
    appFrame: currentFrame,
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
  const mutationLocked = rotoScript.mutationLocked.value;
  // Navigation already locks the engine input and navigation coordinator. Keep
  // the static Studio controls keyed only to real script mutations so the
  // navigation lock's true/false pulse cannot invalidate their memo props.
  const staticControlsLocked = mutationLocked && !rotoScriptNavigationLocked;
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
    // Records-only replacement: both revision reads carry the current Loop
    // Clip collection (loops are replaced via their own port).
    const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId);
    const nextRevision = buildPhysicPaintRotoPhysicalRevision(records, interpolation, currentLoopClips);
    if (buildPhysicPaintRotoPhysicalRevision(beforeRecords, physicPaintStore.getRotoPhysicalInterpolationState(layerId), currentLoopClips) === nextRevision) {
      return physicPaintStore.replaceRotoPhysicalRecords(layerId, records, interpolation, physicPaintStore.getRotoPhysicalCapacity(layerId));
    }
    const repaintBase = cachedRotoRepaintBaseFrameRef.current;
    const realKeyOwnedReference = repaintBase && beforeRecords.some((record) => record.appFrame === repaintBase.appFrame)
      ? { url: cachedRotoReferenceUrlRef.current, cachedRepaintBase: repaintBase }
      : { url: null, cachedRepaintBase: null };
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
        reference: realKeyOwnedReference,
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
      getLoopClips: (layerId) => physicPaintStore.getRotoPhysicalLoopClips(layerId),
      getIncomingInterpolationBreakKeyIds: (layerId) => physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId),
      replaceIncomingInterpolationBreakKeyIds: (layerId, keyIds) => (
        physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, keyIds)
      ),
      replaceLoopClips: (layerId, loopClips) => physicPaintStore.replaceRotoPhysicalLoopClips(layerId, loopClips),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    buffer: {
      get frameStates() { return rotoEditBuffer.bufferRef.current.frameStates; },
      get previewFrames() { return rotoEditBuffer.bufferRef.current.previewFrames; },
      get capturedFrames() { return rotoEditBuffer.bufferRef.current.capturedFrames; },
      get confirmedFrames() { return rotoPersistence.confirmedFramesRef.current; },
      get dirtyFrames() { return rotoEditBuffer.bufferRef.current.dirtyFrames; },
      get liveOverlayActionCounts() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; },
      get editableFrames() { return rotoEditableFramesRef.current; },
      replaceFrameStates: (frames) => { rotoEditBuffer.replaceFrameStates(frames as Map<number, SerializedProject>); },
      replacePreviewFrames: (frames) => { rotoEditBuffer.replacePreviewFrames(frames as Map<number, RenderedFramePayload>); },
      replaceCapturedFrames: (frames) => { rotoEditBuffer.bufferRef.current.capturedFrames = new Map(frames) as Map<number, RenderedFramePayload>; },
      replaceConfirmedFrames: (frames) => { rotoPersistence.confirmedFramesRef.current = new Map(frames) as Map<number, RenderedFramePayload>; },
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
      reconcileCurrentFrame: (appFrame) => {
        loadCachedRotoReferenceFrame(appFrame, engineRef.current as PreviewBackgroundEngine | null);
      },
    },
    engineState: {
      saveEngineState: () => engineRef.current?.save() ?? null,
      loadEngineState: (state) => { engineRef.current?.load(state); },
    },
    launch: {
      getLaunchContext: () => launchContextRef.current,
      setLaunchContextStartFrame: (frame) => { setLaunchContext((current) => current ? { ...current, startFrame: frame } : current); },
      setLaunchContextCachedFrames: (_frames, options) => {
        rotoPersistence.syncCurrentPhysicalDocument(options);
      },
    },
    paint: {
      flushPendingStrokeFinalizations: () => { engineRef.current?.flushPendingStrokeFinalizations(); },
      flushLivePixels: (appFrame) => rotoPersistence.flushLivePixels(appFrame),
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
    getRotoLoopClips: () => launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId) : [],
    getPhysicalCells: () => rotoTimelineModel.physicalCells.value,
    getSelectedKeyId: () => selectedKeyId.value,
    getSelectedKeyIds: () => selectedKeyIds.value,
    getSelectedLoopClipIds: () => effectiveRotoLoopClipSelection?.selectedLoopClipIds ?? [],
    getRotoSpacingSelection: () => reconcilePhysicsPaintRotoSpacingSelection(
      rotoSpacingSelection.peek(),
      (launchContextRef.current ? physicPaintStore.getRotoPhysicalLoopClips(launchContextRef.current.layerId) : [])
        .filter((loopClip) => {
          const currentKeyIds = new Set(launchContextRef.current ? physicPaintStore.getRotoRealKeyRecords(launchContextRef.current.layerId).map((record) => record.keyId) : []);
          return loopClip.sourceKeyIds.every((keyId) => currentKeyIds.has(keyId));
        })
        .map((loopClip) => ({ sourceKeyIds: loopClip.sourceKeyIds })),
    ),
    getCurrentAppFrame: () => currentFrame,
    getLaunchContext: () => launchContextRef.current,
    getCapacity: () => launchContext ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId) : 1,
    getIncomingInterpolationBreakKeyIds: () => launchContext
      ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(launchContext.layerId)
      : [],
    buildBlankRotoFrame: (frame) => ({
      ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame),
      source: 'real-key',
    }),
    executePhysicalEdit: (executeInput) => physicalEditCoordinator.executePhysicalEdit(executeInput as RotoPhysicalEditCoordinatorExecuteInput<SerializedProject>),
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    publishStatus: (message) => { setApplyMessage(message); },
    publishDiagnostic: (message) => { console.error('[PhysicsPaintStudio] physical edit:', message); },
  });
  const rotoPhysicalActions = rotoTimelineActions.physicalActions;
  prepareRotoScriptTargetRef.current = async (source) => {
    const launch = launchContextRef.current;
    if (
      !launch
      || source.layerId !== launch.layerId
      || source.appFrame !== launch.startFrame
      || source.selectionKind === 'generated-interpolation'
    ) return null;

    if (source.selectionKind === 'real-key') {
      if (!source.keyId) return null;
      const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, source.keyId);
      return record?.appFrame === source.appFrame
        ? { keyId: record.keyId, appFrame: record.appFrame }
        : null;
    }
    if (source.keyId !== null) return null;

    const blank = buildBlankRotoFrame(canvasWidth, canvasHeight, source.appFrame);
    const accepted = await dispatchAndWaitForAcceptedRotoPhysicalEdit(
      physicalEditCoordinator.pendingOperationId,
      physicalEditCoordinator.acceptedOutput,
      () => rotoTimelineActions.physicalKeyUtilities.pasteKey(
        source.appFrame,
        {
          frameIndex: blank.frameIndex,
          appFrame: source.appFrame,
          dataUrl: blank.dataUrl,
          ...(blank.width !== undefined ? { width: blank.width } : {}),
          ...(blank.height !== undefined ? { height: blank.height } : {}),
        },
        null,
      ),
    );
    if (
      accepted?.operationKind !== 'paste-key'
      || accepted.after.layerId !== launch.layerId
      || accepted.after.selectedAppFrame !== source.appFrame
      || !accepted.after.selectedKeyId
    ) return null;
    const record = physicPaintStore.getRotoRealKeyRecord(launch.layerId, accepted.after.selectedKeyId);
    return record?.appFrame === source.appFrame
      ? { keyId: record.keyId, appFrame: record.appFrame }
      : null;
  };

  const rotoNavigation = useRotoNavigationCoordinator<RenderedFramePayload>({
    workflowMode,
    beforeNavigation: rotoScript.prepareNavigation,
    afterNavigation: rotoScript.completeNavigation,
    keyUtilities: {
      currentFrame,
      currentKeyId: currentPhysicalCell.kind === 'real' ? currentPhysicalCell.keyId : null,
      physicalKeyUtilities: rotoTimelineActions.physicalKeyUtilities,
      getSelectedKeyIds: () => selectedKeyIds.value,
      getRotoKeyRecords: () => launchContext ? physicPaintStore.getRotoRealKeyRecords(launchContext.layerId) : [],
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
      initialSettings: initialRotoPlaybackSettings,
      getEndFrame: () => launchContext ? physicPaintStore.getRotoPhysicalEndFrame(launchContext.layerId) : null,
      getFrame: findCachedRotoDisplayFrame,
      onStart: (frameCount) => { rotoPlaybackFrameCount.value = frameCount; },
      onFrame: (frameIndex) => {
        rotoPlaybackFrameIndex.value = frameIndex;
      },
      setIsPlaying,
    },
  });
  const rotoKeyUtilities = rotoNavigation.keyUtilities;
  const rotoSession = rotoKeyUtilities.session;
  const addRotoKey = rotoKeyUtilities.addKey;
  const duplicateRotoKey = rotoKeyUtilities.duplicateKey;
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  // Cut (quick 260731-9l0): enabled only when BOTH copy and delete
  // availability hold; the delete half is re-checked here so the keyboard
  // entry point enforces the same rule as the strip button.
  const cutRotoFrame = useCallback(() => {
    if (!rotoPhysicalActions.canDeleteFrame.value) {
      setApplyMessage(rotoPhysicalActions.deleteDisabledReason.value ?? 'Deleting the selected Roto keys is unavailable.');
      return;
    }
    rotoKeyUtilities.cutKey(rotoPhysicalActions.deleteRotoFrame);
  }, [rotoPhysicalActions, rotoKeyUtilities]);
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;
  const rotoCachedPlayback = rotoNavigation.playback;
  const rotoPlaybackSettingsController = useRotoPlaybackSettingsController({
    initialContext: launchContext ? { context: launchContext, settings: initialRotoPlaybackSettings } : null,
    send: async (payload) => {
      const mode = bridgeModeRef.current === 'Unavailable'
        ? await detectPhysicsPaintBridgeMode()
        : bridgeModeRef.current;
      await sendPhysicPaintApplyPayload(payload, mode);
    },
    applyLocalSettings: rotoCachedPlayback.replaceSettings,
    setError: (message) => {
      setLastError(message);
      if (message) setApplyMessage(message);
    },
  });
  playbackSettingsRouteRef.current = {
    consumeBridgeApplyResult: rotoPlaybackSettingsController.handleApplyResult,
  };
  const setRotoPlaybackLoop = useCallback((loop: boolean) => {
    rotoCachedPlayback.setLoop(loop);
    rotoPlaybackSettingsController.enqueue(rotoCachedPlayback.getSettings());
  }, [rotoCachedPlayback, rotoPlaybackSettingsController]);
  const setRotoPlaybackFps = useCallback((fps: number) => {
    rotoCachedPlayback.updateFps(fps);
    rotoPlaybackSettingsController.enqueue(rotoCachedPlayback.getSettings());
  }, [rotoCachedPlayback, rotoPlaybackSettingsController]);
  usePhysicsPaintCloseFlush(
    () => workflowMode === 'roto' && Boolean(engineRef.current?.getStrokeCount() || rotoPersistence.hasPendingLivePixels() || rotoPlaybackSettingsController.hasPending()),
    async () => {
      if (workflowMode !== 'roto') return;
      engineRef.current?.flushPendingStrokeFinalizations();
      await rotoPersistence.flushLivePixels(currentFrame);
      await rotoPlaybackSettingsController.flush();
    },
    // 41-05 (D-08): audio engine release runs unconditionally on close,
    // before the hasPending gate — closing the window always stops and
    // releases monitoring, even with nothing to flush.
    () => efxPaintAudioMonitor.release(),
  );
  // 41-05 (D-08): release the audio engine on Studio unmount as well — the
  // close-requested hook above covers the window-close path; this covers
  // unmount. Double-firing is absorbed by release() idempotency.
  useEffect(() => () => { efxPaintAudioMonitor.release(); }, []);
  // Header Close intent routes through getCurrentWindow().close() so the
  // onCloseRequested flush above always runs (T-36.15-06); the browser bridge
  // falls back to window.close() when the Tauri window API is unavailable.
  const handleWorkflowClose = useCallback(() => {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().close())
      .catch(() => { window.close(); });
  }, []);
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
    // D-08R/D-18: read-only live brush-color port — setBrushColor remains the sole writer;
    // the controller only observes and snapshots settings.color at confirm time.
    getBrushColor: () => settings.color,
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    getOperationLocked: () => rotoScript.mutationLocked.peek() || rotoScriptNavigationLocked,
    getSize: () => ({ width: canvasWidth, height: canvasHeight }),
    // 43-06: the durable Loop Clip collection the loop-edit/source-edit modes
    // and the atomic loop ops operate on (43-05 port, wired here).
    getRotoLoopClips: () => (launchContext ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId) : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY),
    // 43-11: opening Loop Edit reads the already-accepted child document
    // synchronously. Mutation commits still request fresh parent authority.
    getLoopEditSnapshot: (placementStart) => {
      if (!launchContext) return null;
      const document = physicPaintStore.getRotoPhysicalDocument(launchContext.layerId);
      if (!document) return null;
      const physicalCapacity = physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId);
      return {
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        physicalCapacity,
        layerEndExclusive: physicalCapacity,
        remainingCapacity: Math.max(0, physicalCapacity - placementStart),
        interpolationEnabled: document.interpolation.enabled,
      };
    },
    executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    acceptedOutput: physicalEditCoordinator.acceptedOutput,
    stopPlayback: rotoCachedPlayback.stop,
    log: (message, isError) => { setApplyMessage(message); if (isError) setLastError(message); },
  }, bridgeMode);
  const clearRotoLoopSelection = useCallback(() => {
    selectedLoopClipIds.value = [];
    loopSelectionAnchorId.value = null;
    selectedLoopClipId.value = null;
  }, []);
  const handleSelectRotoLoopClip = useCallback((
    loopId: string | null,
    gesture: PhysicsPaintRotoSpacingSelectionGesture = 'plain',
  ) => {
    if (loopId === null) {
      clearRotoLoopSelection();
      return;
    }
    const currentIds = selectedLoopClipIds.peek();
    const currentAnchor = loopSelectionAnchorId.peek();
    const currentPrimary = selectedLoopClipId.peek();
    const next = updatePhysicsPaintRotoLoopClipSelection(
      currentIds.length > 0 && currentAnchor !== null && currentPrimary !== null
        ? {
          selectedLoopClipIds: currentIds,
          anchorLoopClipId: currentAnchor,
          primaryLoopClipId: currentPrimary,
        }
        : null,
      orderedRotoLoopClipIds,
      loopId,
      gesture,
    );
    if (next === null) {
      clearRotoLoopSelection();
      return;
    }
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    rotoSpacingSelection.value = null;
    selectedLoopClipIds.value = next.selectedLoopClipIds;
    loopSelectionAnchorId.value = next.anchorLoopClipId;
    selectedLoopClipId.value = next.primaryLoopClipId;
  }, [clearRotoLoopSelection, orderedRotoLoopClipIds]);
  const handleOpenRotoLoopEdit = useCallback(
    (loopId: string) => {
      selectedLoopClipId.value = loopId;
      return rotoPlayScript.openLoopEdit(loopId);
    },
    [rotoPlayScript],
  );
  const handleCloseRotoLoopClip = useCallback(() => {
    clearRotoLoopSelection();
  }, [clearRotoLoopSelection]);
  const loopResolutionContext = rotoTimelineModel.loopResolutionContext.value;
  const loopScriptRows = rotoScriptLibrary.rows.value;
  const loopPresentations = useMemo(() => {
    const clipsById = new Map(rotoLoopClips.map((clip) => [clip.loopId, clip]));
    const scriptsById = new Map(loopScriptRows.map((row) => [row.id, row]));
    return new Map((loopResolutionContext?.ranges ?? []).map((range) => {
      const clip = clipsById.get(range.loopId);
      const sourceScriptName = clip?.scriptId ? scriptsById.get(clip.scriptId)?.name ?? null : null;
      return [
        range.loopId,
        projectPhysicsPaintLoopClipPresentation(range, clip, sourceScriptName),
      ] as const;
    }));
  }, [loopResolutionContext, loopScriptRows, rotoLoopClips]);
  const selectedLoopClip = selectedLoopClipId.value === null
    ? null
    : loopPresentations.get(selectedLoopClipId.value) ?? null;
  const resetRotoSpacingSelectionSession = useCallback((options?: { clearClipboard?: boolean }) => {
    rotoSpacingSelection.value = null;
    clearRotoLoopSelection();
    rotoKeyUtilities.resetSession(options);
  }, [clearRotoLoopSelection, rotoKeyUtilities]);
  resetRotoKeySessionRef.current = resetRotoSpacingSelectionSession;
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
  const beginRotoFrameEditImplRef = useRef<() => void>(() => {});
  beginRotoFrameEditImplRef.current = () => {
    const launch = launchContextRef.current;
    if (currentFrameSelectionKind !== 'empty' || !launch) {
      pendingFirstPaintTargetRef.current = null;
      rotoFrameEditing.beginFrameEdit();
      return;
    }
    if (pendingFirstPaintTargetRef.current) return;

    const request = prepareRotoScriptTargetRef.current({
      selectionKind: 'empty',
      layerId: launch.layerId,
      keyId: null,
      appFrame: currentFrame,
    });
    const pending = {
      launchOperationId: launch.operationId,
      layerId: launch.layerId,
      appFrame: currentFrame,
      promise: request,
    };
    pendingFirstPaintTargetRef.current = pending;
    void request.then((target) => {
      if (pendingFirstPaintTargetRef.current !== pending) return;
      if (!target) {
        pendingFirstPaintTargetRef.current = null;
        return;
      }
      rotoFrameEditing.beginFrameEdit();
    }).catch((error) => {
      if (pendingFirstPaintTargetRef.current === pending) pendingFirstPaintTargetRef.current = null;
      console.error('[PhysicsPaintStudio] Could not create the first Roto key', error);
    });
  };
  const beginRotoFrameEdit = useCallback(() => {
    beginRotoFrameEditImplRef.current();
  }, []);
  acceptRotoScriptBrushRef.current = rotoFrameEditing.acceptScriptBrush;
  // 38-11: rotoFrameEditing's wrapper object is rebuilt per render (its inner
  // callbacks close over a per-render input literal), so callbacks that must
  // stay referentially stable reach it through a ref instead of a hook dep.
  const rotoFrameEditingRef = useRef(rotoFrameEditing);
  rotoFrameEditingRef.current = rotoFrameEditing;
  useRotoBackgroundMetadataSync({ launchContext, settings });
  // 38.1 D-08 link 3: playback availability without a per-render O(N) array
  // build. Equivalence with selectRotoPlaybackAvailable (some-style boolean):
  // no launch -> false; empty list -> false; all-missing -> false; mixed ->
  // true iff any frame resolves — the physical-input branch reads the same
  // getRenderSource truth loadCachedRotoReferenceFrame and findCachedRotoDisplayFrame
  // consult, so availability cannot diverge from the frames the canvas would
  // actually paint. Recomputes only when the structural frame list or launch
  // identity changes, never on a pure Studio render.
  const rotoPlaybackFrameNumbers = rotoSession.playbackFrameNumbers.value;
  const rotoPlaybackLayerId = launchContext?.layerId ?? null;
  const rotoCachedPlaybackAvailableFrames = useMemo(() => {
    if (rotoPlaybackLayerId === null) return [];
    return rotoPlaybackFrameNumbers.flatMap((appFrame) => {
      const source = physicPaintStore.getRotoPhysicalRenderSource(rotoPlaybackLayerId, appFrame);
      if (!source) return [];
      // Phase 43 (D-28, audit finding 6): the loop placeholder never
      // contributes playback payload — the preview surface renders it as the
      // marked placeholder and Studio playback continues past it without
      // blocking. A future render-source variant is a compile-time error at
      // this consumer (Pitfall 7 never-fallback convention).
      switch (source.kind) {
        case 'loop-placeholder':
          return [];
        case 'real':
        case 'generated':
          return [{ appFrame, frame: source.renderedFrame }];
        default: {
          const exhaustive: never = source;
          throw new Error(`Unhandled Roto physical render-source kind: ${JSON.stringify(exhaustive)}`);
        }
      }
    });
  }, [rotoPlaybackLayerId, rotoPlaybackFrameNumbers]);
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
  // 38-11: launchContext identity changes on every navigation (startFrame
  // propagation) and rotoFrameEditing is rebuilt per render — both route
  // through refs so this callback keeps a stable identity across
  // startFrame-only renders. The guards read the exact same live values.
  const clearActiveSource = useCallback(() => {
    if (rotoScript.mutationLocked.peek() || !engine || !launchContextRef.current) return;
    if (rotoFrameEditingRef.current.clearCurrentFrame()) rotoScript.notifySourceRevision();
  }, [engine, rotoScript]);
  const dryPaint = useCallback(() => {
    if (rotoScript.mutationLocked.peek()) return;
    engine?.forceDry();
  }, [engine, rotoScript]);
  const navigateToSyncedPhysicalFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    rotoCachedPlayback.stop();
    // 38.1 D-05: begin the navigation generation BEFORE any await so a newer
    // navigation started during the flush supersedes this one.
    const generation = rotoNavigationGeneration.begin();
    if (launchContext) {
      engine?.flushPendingStrokeFinalizations();
      // 38.1-07 D-03 (strengthened): INITIATE the save-before-leave flush
      // WITHOUT awaiting. The flush operates on ALREADY-CAPTURED live-pixel
      // transaction buffers and parent deliveries — it captures no engine
      // pixels at await time, so the engine.clear() below cannot corrupt it.
      // The flush is always initiated and always awaited afterward with the
      // verbatim error path — never skipped, never weakened (save-before-leave,
      // RESEARCH Pitfall 5).
      const flushPromise = rotoPersistence.flushLivePixels(currentFrame);
      // 38.1 D-03 canvas-first: the engine paint issues NOW, in the navigation
      // intent tick — zero intervening awaits since begin(), so the generation
      // cannot be superseded before this paint (no pre-paint isLatest recheck).
      setCachedRotoReferenceUrl(null);
      if (engine) {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
      try {
        await flushPromise;
      } catch {
        setApplyStatus('error');
        setApplyMessage(`Could not save Roto frame ${currentFrame} before navigation.`);
        return false;
      }
      // 38.1 D-05: superseded navigation — a newer intent owns the canvas. The
      // same-tick paint above already happened (the approved D-03 trade), but
      // a superseded navigation never propagates and never repaints.
      if (!rotoNavigationGeneration.isLatest(generation)) return false;
      // 38.1-07: post-flush neighbor pickup — a generated destination repaints
      // once so it picks up the just-flushed neighbor key pixels. The kind
      // check reads the O(1) cached projection — never
      // getRotoPhysicalRenderSource, which would run the interpolation render.
      if (engine && physicPaintStore.getRotoPhysicalProjection(launchContext.layerId)?.cells[frame]?.kind === 'generated') {
        setCachedRotoReferenceUrl(null);
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    if (launchContext) {
      const selectedRecord = physicPaintStore.getRotoRealKeyRecordByAppFrame(launchContext.layerId, frame);
      const nextSelectedKeyId = selectedRecord?.keyId ?? null;
      if (selectedKeyId.peek() !== nextSelectedKeyId) selectedKeyId.value = nextSelectedKeyId;
      physicPaintStore.setRotoPhysicalSelection(launchContext.layerId, selectedKeyId.value, frame);
    }
    // 38.1 D-04: the startFrame update — the full-Studio-render driver via
    // currentFrame — is rAF-batched so a click burst coalesces to at most one
    // Studio render per animation frame showing the LATEST frame.
    scheduleRotoStartFramePropagation(frame);
    pendingFrameSyncRef.current = frame;
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, currentFrame, engine, launchContext, loadCachedRotoReferenceFrame, rotoCachedPlayback, rotoNavigationGeneration, rotoPersistence, scheduleRotoStartFramePropagation, setCachedRotoReferenceUrl, selectedKeyId]);
  rotoNavigation.configureRuntimePort({ navigateToSyncedFrame: navigateToSyncedPhysicalFrame });
  rotoNavigation.configureDisplayPort({
    restoreFrame: (effect) => {
      const frame = effect.restore.frame;
      // 38.1 D-03/D-04: canvas paint first within this flow; the startFrame
      // update propagates through the same rAF scheduler as navigation.
      if (engine && (effect.restore.kind === 'load-real-key' || effect.restore.kind === 'blank-real-key')) loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      else if (engine && effect.restore.kind === 'clear-blank') {
        engine.clearPreviewBaseImage();
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
      scheduleRotoStartFramePropagation(frame);
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
    identity: launchContext ? {
      launchOperationId: launchContext.operationId,
      layerId: launchContext.layerId,
      projectContextId: launchContext.project?.contextId ?? null,
      capacity: rotoPhysicalCapacity,
    } : null,
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
      getLoopClips: (layerId) => physicPaintStore.getRotoPhysicalLoopClips(layerId),
      getIncomingInterpolationBreakKeyIds: (layerId) => physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId),
      replaceIncomingInterpolationBreakKeyIds: (layerId, keyIds) => (
        physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(layerId, keyIds)
      ),
      replaceLoopClips: (layerId, loopClips) => physicPaintStore.replaceRotoPhysicalLoopClips(layerId, loopClips),
      replaceRecords: replacePhysicalRecordsWithOwnership,
    },
    getLiveSourceSnapshot: () => {
      const liveLaunch = launchContextRef.current;
      const layerId = liveLaunch?.layerId ?? '';
      const records = layerId ? physicPaintStore.getRotoRealKeyRecords(layerId) : [];
      const liveSelectedKeyId = selectedKeyId.peek();
      const selectedRecord = liveSelectedKeyId === null
        ? null
        : records.find((record) => record.keyId === liveSelectedKeyId) ?? null;
      return {
        launchOperationId: liveLaunch?.operationId ?? '',
        layerId,
        projectContextId: liveLaunch?.project?.contextId ?? null,
        records,
        interpolation: layerId
          ? physicPaintStore.getRotoPhysicalInterpolationState(layerId)
          : PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
        loopClips: layerId
          ? physicPaintStore.getRotoPhysicalLoopClips(layerId)
          : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
        incomingInterpolationBreakKeyIds: layerId
          ? physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layerId)
          : [],
        capacity: layerId ? physicPaintStore.getRotoPhysicalCapacity(layerId) : 0,
        selectedKeyId: selectedRecord?.keyId ?? null,
        selectedAppFrame: selectedRecord?.appFrame ?? null,
        currentAppFrame: liveLaunch?.startFrame ?? 0,
      };
    },
    undoPaint: rotoFrameEditing.undo,
    redoPaint: rotoFrameEditing.redo,
  });

  // 38-11: the history hook returns a fresh wrapper object per render, but
  // its inner undo/redo callbacks are stable (useCallback over the stable
  // publishAvailability). Depending on the inner callbacks keeps these
  // wrappers referentially stable across startFrame-only renders; behavior
  // is byte-identical.
  const rotoMoveHistoryUndo = rotoMoveHistory.undo;
  const rotoMoveHistoryRedo = rotoMoveHistory.redo;
  const undo = useCallback(async () => {
    const changed = await rotoMoveHistoryUndo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistoryUndo, rotoScript]);
  const redo = useCallback(async () => {
    const changed = await rotoMoveHistoryRedo();
    if (changed) rotoScript.notifySourceRevision();
    return changed;
  }, [rotoMoveHistoryRedo, rotoScript]);

  const requestRotoFrameNavigation = rotoNavigation.requestNavigation;
  const { getStrokeMetadata } = usePhysicsPaintLaunchIntegration({
    engineRef,
    lifecycle: {
      pendingFrameSyncRef,
      pendingApplyRef,
      activeOperationIdRef,
      prepareScriptLaunchReplacement: rotoScript.prepareLaunchReplacement,
      preparePlaybackSettingsLaunchReplacement: () => rotoPlaybackSettingsController.hasPending()
        ? rotoPlaybackSettingsController.flush()
        : Promise.resolve(),
      completeScriptLaunchReplacement: rotoScript.completeLaunchReplacement,
      cancelPhysicalEditForLaunch: () => { physicalEditCoordinator.cancelPhysicalEdit('launch-replacement'); },
      disposePhysicalEditSettlement: () => { physicalEditCoordinator.cancelPhysicalEdit('disposal'); },
    },
    state: {
      setLaunchContext, setSettings, setApplyStatus, setApplyMessage, setLastError,
    },
    peekLaunchContext: () => launchContext,
    resetPersistenceForLaunch: rotoPersistence.resetForLaunch,
    resetNavigationForLaunchRef: resetRotoNavigationForLaunchRef,
    hydratePlaybackSettingsForLaunch: rotoPlaybackSettingsController.hydrateForLaunch,
    resetCachedReference: resetCachedRotoReference,
    loadCachedReferenceFrame: (frame, readyEngine) => { loadCachedRotoReferenceFrame(frame, readyEngine ?? null); },
    onSettledLaunchContext: (context) => { void rotoScriptLibrary.updateProjectContext(context); },
  });
  usePhysicsPaintWorkflowIntegration({
    session: {
      engine, canvasSize: { width: canvasWidth, height: canvasHeight }, launchContext, currentFrame,
      setLaunchContext, setApplyStatus, setApplyMessage, setLastError,
      isMutationLocked: () => rotoScript.mutationLocked.peek(),
    },
  });
  physicalEditCoordinatorRouteRef.current = {
    consumeBridgeApplyResult: (detail) => {
      const transition = physicalEditCoordinator.consumeBridgeApplyResult(detail);
      const accepted = physicalEditCoordinator.acceptedOutput.peek();
      if (transition === 'accepted' && accepted) {
        // D-17 post-acceptance selection aftermath: group-aware kinds keep
        // the set (move re-anchors to the grabbed key; force-spacing keyIds
        // survive retiming; paste-key-group selects the pasted set with the
        // earliest pasted key as anchor); group delete and every other kind
        // collapse to the accepted selectedKeyId.
        // acceptedAddedKeyIds derives ONLY from the accepted before/after
        // record keyId diff (38-DOWNSTREAM-PARITY — no store/session reads);
        // after.records is appFrame-sorted by resolver contract, so the list
        // is ordered earliest-first with no additional sort.
        const beforeKeyIds = new Set(accepted.before.records.map((record) => record.keyId));
        const acceptedAddedKeyIds = accepted.after.records
          .filter((record) => !beforeKeyIds.has(record.keyId))
          .map((record) => record.keyId);
        const railSelectionActive = selectedLoopClipIds.peek().length > 0;
        const nextSelection = railSelectionActive
          ? { selectedKeyIds: [], anchorKeyId: null }
          : resolvePostAcceptanceRotoSelection({
            operationKind: accepted.operationKind,
            acceptedSelectedKeyId: accepted.after.selectedKeyId,
            state: { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() },
            currentKeyId: accepted.after.selectedKeyId,
            acceptedAddedKeyIds,
          });
        selectedKeyIds.value = nextSelection.selectedKeyIds;
        selectionAnchorKeyId.value = nextSelection.anchorKeyId;
      }
      const currentLaunch = launchContextRef.current;
      const currentEngine = engineRef.current;
      const selectedKeyId = accepted?.after.selectedKeyId ?? null;
      const selectedAppFrame = accepted?.after.selectedAppFrame ?? null;
      const createdSelectedDestination = (accepted?.operationKind === 'paste-key' || accepted?.operationKind === 'paste-key-group')
        && selectedKeyId !== null
        && selectedAppFrame !== null
        && !accepted.before.records.some((record) => record.keyId === selectedKeyId)
        && accepted.after.records.some((record) => record.keyId === selectedKeyId && record.appFrame === selectedAppFrame);
      if (
        transition === 'accepted'
        && accepted?.operationId === detail?.operationId
        && createdSelectedDestination
        && currentLaunch?.operationId === accepted.after.launchOperationId
        && currentLaunch.layerId === accepted.after.layerId
        && currentLaunch.startFrame === selectedAppFrame
        && currentEngine
      ) {
        loadCachedRotoReferenceFrame(selectedAppFrame, currentEngine as PreviewBackgroundEngine);
      }
      return transition;
    },
  };
  const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({
    state: { currentFrame, isPlaying, mutationLocked },
    savedRotoFrames: timelineSavedRotoFrames,
    actions: {
      undo,
      redo,
      copyRotoKey: copyRotoFrame,
      cutRotoKey: cutRotoFrame,
      pasteRotoKey: pasteRotoFrame,
      deleteRotoKey: rotoPhysicalActions.deleteRotoFrame,
      selectAllRotoKeys,
      collapseRotoSelection: () => {
        // D-02: collapse only an active multi-selection; a single-key
        // selection is already collapsed and stays untouched.
        if (selectedKeyIds.value.length <= 1) return;
        const next = collapseRotoKeySelection(selectedKeyId.peek());
        selectedKeyIds.value = next.selectedKeyIds;
        selectionAnchorKeyId.value = next.anchorKeyId;
      },
      toggleShortcuts: () => setShortcutsVisible((visible) => !visible),
      toggleRotoPlayback: rotoCachedPlayback.toggle,
      navigateRotoFrame: (frame) => { void requestRotoFrameNavigation(frame); },
      toggleOnion: () => setOnion((current) => ({ ...current, enabled: !current.enabled })),
      adjustOnionCount: (delta) => setOnion((current) => ({ ...current, count: clampOnionCount(current.count + delta) })),
    },
  });
  // 38.1 D-08 link 3: onion projection behind structural memoization — the
  // dependency array enumerates exactly its real inputs, so the projection
  // re-runs on every genuine input change (including currentFrame) but stops
  // re-running on unrelated Studio renders. What it computes is unchanged.
  const rotoOnionPreviewFrames = rotoPreviewFramesRef.current;
  const rotoOnionDirtyFrames = dirtyRotoFramesRef.current;
  const onionPreviewFrames = useMemo(() => projectRotoOnionPreviewFrames({
    currentFrame,
    isPlaying,
    onion,
    realKeyRecords: rotoKeyRecords,
    getRenderSource: (appFrame) => launchContext ? physicPaintStore.getRotoPhysicalRenderSource(launchContext.layerId, appFrame) : null,
    previewFrames: rotoOnionPreviewFrames,
    dirtyFrames: rotoOnionDirtyFrames,
  }), [currentFrame, isPlaying, onion, rotoKeyRecords, launchContext, rotoOnionPreviewFrames, rotoOnionDirtyFrames]);
  const rotoCachedPlaybackAvailable = selectRotoPlaybackAvailable({
    workflowMode,
    hasLaunchContext: Boolean(launchContext),
    frames: rotoCachedPlaybackAvailableFrames,
  });
  const { updateRotoInterpolationSettings } = useRotoInterpolationController({
    launchContext,
    interpolation: rotoInterpolationState,
    records: rotoKeyRecords,
    selectedKeyId: selectedKeyId.value,
    selectedAppFrame: selectedKeyId.value === null ? null : currentFrame,
    pendingOperationId: physicalEditCoordinator.pendingOperationId,
    executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
    isMutationLocked: () => rotoScript.mutationLocked.peek(),
  });
  const updateRotoInterpolationSettingsRef = useRef(updateRotoInterpolationSettings);
  updateRotoInterpolationSettingsRef.current = updateRotoInterpolationSettings;
  const requestRotoFrameNavigationRef = useRef(requestRotoFrameNavigation);
  requestRotoFrameNavigationRef.current = requestRotoFrameNavigation;
  const rotoKeyRecordsRef = useRef(rotoKeyRecords);
  rotoKeyRecordsRef.current = rotoKeyRecords;
  const handleRotoInterpolationEnabledChange = useCallback((enabled: boolean) => {
    void updateRotoInterpolationSettingsRef.current({ enabled });
  }, []);
  const handleRotoInterpolationModeChange = useCallback((mode: PhysicPaintRotoInterpolationState['mode']) => {
    void updateRotoInterpolationSettingsRef.current({ mode });
  }, []);
  const handleSelectRotoSpacingProxy = useCallback((
    proxy: PhysicsPaintRotoSpacingProxy,
    gesture: PhysicsPaintRotoSpacingSelectionGesture,
  ) => {
    clearRotoLoopSelection();
    const current = rotoSpacingSelection.peek();
    const next = gesture === 'toggle'
      ? togglePhysicsPaintRotoSpacingProxy(current, proxy)
      : gesture === 'range'
        ? extendPhysicsPaintRotoSpacingProxyRange(current, proxy)
        : selectPhysicsPaintRotoSpacingProxyPlain(current, proxy);
    rotoSpacingSelection.value = next;
    selectedKeyIds.value = next?.selectedSourceKeyIds ?? [];
    selectionAnchorKeyId.value = next
      ? next.sourceKeyIds[next.anchorSourceIndex] ?? null
      : null;
  }, [clearRotoLoopSelection]);
  const handleClearRotoSpacingSelection = useCallback(() => {
    rotoSpacingSelection.value = null;
  }, []);
  const handleClearRotoKeySelection = useCallback(() => {
    selectedKeyIds.value = [];
    selectionAnchorKeyId.value = null;
    clearRotoLoopSelection();
  }, [clearRotoLoopSelection]);
  const handleToggleRotoKeySelection = useCallback((keyId: string) => {
    clearRotoLoopSelection();
    const result = toggleRotoKeySelection(
      { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() },
      rotoKeyRecordsRef.current.map((record) => record.keyId),
      keyId,
      selectedKeyId.peek(),
    );
    selectedKeyIds.value = result.state.selectedKeyIds;
    selectionAnchorKeyId.value = result.state.anchorKeyId;
    selectedKeyId.value = result.currentKeyId;
  }, [clearRotoLoopSelection]);
  const handleCollapseRotoSelectionToKey = useCallback((keyId: string) => {
    clearRotoLoopSelection();
    const next = collapseRotoKeySelection(keyId);
    selectedKeyIds.value = next.selectedKeyIds;
    selectionAnchorKeyId.value = next.anchorKeyId;
  }, [clearRotoLoopSelection]);
  const handleExtendRotoKeySelection = useCallback((keyId: string) => {
    clearRotoLoopSelection();
    const result = extendRotoKeySelectionRange(
      { selectedKeyIds: selectedKeyIds.peek(), anchorKeyId: selectionAnchorKeyId.peek() ?? selectedKeyId.peek() },
      rotoKeyRecordsRef.current.map((record) => record.keyId),
      keyId,
    );
    selectedKeyIds.value = result.state.selectedKeyIds;
    selectionAnchorKeyId.value = result.state.anchorKeyId;
    if (result.currentKeyId !== null) selectedKeyId.value = result.currentKeyId;
  }, [clearRotoLoopSelection]);
  const handleRotoGroupDragRejected = useCallback((reason: string, detail: string) => {
    setApplyMessage(reason);
    console.error('[PhysicsPaintStudio] physical edit:', detail);
  }, []);
  const handleNavigateToSyncedFrame = useCallback((frame: number) => {
    void requestRotoFrameNavigationRef.current(frame);
  }, []);
  const rotoNavigationActions = rotoNavigation.createNavigationActions({
    currentFrame,
    framesToApply: 1,
    savedFrames: timelineSavedRotoFrames,
    playFrames: [],
  });
  const rotoNavigationActionsRef = useRef(rotoNavigationActions);
  rotoNavigationActionsRef.current = rotoNavigationActions;
  const handleGoToFirstFrame = useCallback(() => { rotoNavigationActionsRef.current.goToFirstFrame(); }, []);
  const handleGoToPreviousFrame = useCallback(() => { rotoNavigationActionsRef.current.goToPreviousFrame(); }, []);
  const handleGoToNextFrame = useCallback(() => { rotoNavigationActionsRef.current.goToNextFrame(); }, []);
  const handleGoToLastFrame = useCallback(() => { rotoNavigationActionsRef.current.goToLastFrame(); }, []);
  // Script Motion (D-04): deform/position remain a separate store/controller
  // contract, never merged into interpolation enabled state.
  // 38-11: stable identity via launchContextRef — launchContext identity
  // changes on every navigation while the live values read are identical.
  const updatePanelMotion = useCallback((motion: { strokeDeformation: number; strokePosition: number }) => {
    const launch = launchContextRef.current;
    if (!launch) return;
    const current = physicPaintStore.getRotoInterpolationSettings(launch.layerId);
    physicPaintStore.setRotoInterpolationSettings(launch.layerId, { ...current, deform: motion.strokeDeformation, position: motion.strokePosition });
  }, []);
  const layout = layoutPropsMemo.resolve([rightPanelCollapsed, handlePhysicsPaintKeyDown, handleSetRightPanelCollapsed], () => ({
    rightPanelCollapsed,
    onKeyDown: handlePhysicsPaintKeyDown,
    onSetRightPanelCollapsed: handleSetRightPanelCollapsed,
  }));
  const topBar = topBarPropsMemo.resolve([settings.size, settings.opacity, settings.background, settings.paperGrain, settings.grainStrength, readyToApply, staticControlsLocked, setBrushSize, setBrushOpacity, setBackground, setPaperGrain, setGrainStrength], () => ({
    brushSize: settings.size,
    opacity: settings.opacity,
    background: settings.background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    ready: readyToApply,
    disabled: staticControlsLocked,
    onBrushSizeChange: setBrushSize,
    onOpacityChange: setBrushOpacity,
    onBackgroundChange: setBackground,
    onPaperGrainChange: setPaperGrain,
    onGrainStrengthChange: setGrainStrength,
  }));
  // 38-11: the tool rail props assemble behind the identity memo — the
  // single-line deps array below enumerates exactly the values the build
  // references (38.1 onion-projection idiom); it contains no frame-derived
  // input, so a startFrame-only Studio render returns the cached object and
  // the memo-wrapped rail skips its render. Signal objects pass through by
  // identity (never .value-cached), so signal-driven updates keep flowing.
  const toolRail = toolRailPropsMemo.resolve([settings.tool, settings.physicsMode, settings.activePhysicsAction, historyAvailability, engine, staticControlsLocked, selectTool, undo, redo, clearActiveSource, startPhysics, stopPhysics, dryPaint], () => ({
    activeTool: settings.tool,
    physicsMode: settings.physicsMode,
    activePhysicsAction: settings.activePhysicsAction,
    historyAvailability,
    disabled: !engine || staticControlsLocked,
    onSelectTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onClearFrame: clearActiveSource,
    onPhysicsStart: startPhysics,
    onPhysicsStop: stopPhysics,
    onDryPaint: dryPaint,
  }));
  // 38-11: the right panel props assemble behind the identity memo — the
  // single-line deps array below enumerates exactly the values the build
  // references (38.1 onion-projection idiom); it contains no frame-derived
  // input, so a startFrame-only Studio render returns the cached object and
  // the memo-wrapped panel skips its render. playWiggle reads through the
  // memoized rotoLegacyInterpolationSettings (WR-02, b74ac80a) — never a
  // fresh per-render getRotoInterpolationSettings clone. Signal-backed
  // controllers pass through by identity so their signal subscriptions
  // (ScriptsPanel rows/busy/selection) keep flowing independent of the memo.
  const rightPanel = rightPanelPropsMemo.resolve([settings.tool, settings.color, settings.opacity, settings.edgeDetail, settings.pickup, settings.spread, settings.smoothing, settings.eraseStrength, settings.physicsMode, onion, isPlaying, staticControlsLocked, rotoLegacyInterpolationSettings, setBrushColor, setEdgeDetail, setPickup, setSpread, setSmoothing, setEraseStrength, setOnion, updatePanelMotion, rotoScriptLibrary, rotoPlayScript, rotoScript, playButtonRef, selectedLoopClip, handleOpenRotoLoopEdit, handleCloseRotoLoopClip, handleScriptRowActivate, handleSelectedScriptLoadAndApply, setLastError], () => ({
    activeTool: settings.tool,
    color: settings.color,
    opacity: settings.opacity,
    edgeDetail: settings.edgeDetail,
    pickup: settings.pickup,
    spread: settings.spread,
    smoothing: settings.smoothing,
    eraseStrength: settings.eraseStrength,
    physicsMode: settings.physicsMode,
    onion,
    onionDisabled: isPlaying,
    engineControlsDisabled: staticControlsLocked,
    playWiggle: rotoLegacyInterpolationSettings
      ? { strokeDeformation: rotoLegacyInterpolationSettings.deform, strokePosition: rotoLegacyInterpolationSettings.position }
      : { strokeDeformation: 0, strokePosition: 0 },
    onColorChange: setBrushColor,
    onEdgeDetailChange: setEdgeDetail,
    onPickupChange: setPickup,
    onSpreadChange: setSpread,
    onSmoothingChange: setSmoothing,
    onEraseStrengthChange: setEraseStrength,
    onOnionChange: setOnion,
    onPlayWiggleChange: updatePanelMotion,
    scripts: {
      library: rotoScriptLibrary,
      playScript: rotoPlayScript,
      rotoScript,
      playButtonRef,
      selectedLoopClip,
      onOpenLoopEdit: handleOpenRotoLoopEdit,
      onCloseLoopClip: handleCloseRotoLoopClip,
      onSave: () => { void rotoScriptLibrary.saveActiveFrame(); },
      onActivateRow: (id: string) => { void handleScriptRowActivate(id); },
      onLoadAndApply: () => { void handleSelectedScriptLoadAndApply(); },
      onDiscardScript: () => { rotoScript.discardScript(); setLastError(null); },
      onCopyScript: () => { void rotoScript.copyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); },
      onApplyScript: () => { void rotoScript.applyScript().then((success) => { if (success) setLastError(null); else { const message = rotoScript.error.peek()?.message; if (message) setLastError(message); } }); },
      onRefresh: () => { void rotoScriptLibrary.refresh(); },
    },
  }));
  const playScriptConfirmationOpen = rotoPlayScript.confirmationOpen.value;
  const playScriptDialog = playScriptDialogPropsMemo.resolve([rotoPlayScript, playScriptConfirmationOpen, playButtonRef, settings.color], () => ({
    playScript: rotoPlayScript,
    confirmationOpen: playScriptConfirmationOpen,
    // D-08R: live brush color prop — the dialog re-renders on right-panel picks (settings.color
    // identity change re-resolves the memo) while reading the single setBrushColor-owned source.
    brushColor: settings.color,
    returnFocusRef: playButtonRef,
  }));
  const canvasEngineReadyImplRef = useRef<(readyEngine: EfxPaintEngine) => void>(() => {});
  canvasEngineReadyImplRef.current = (readyEngine) => {
    readyEngine.setHistoryAvailabilityListener((availability) => {
      rotoMoveHistory.reconcilePaintBarriers(availability);
      rotoScript.notifySourceRevision();
    });
    handleEngineReady(readyEngine);
    rotoScript.updateEngine(readyEngine);
    if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine);
  };
  const handleCanvasEngineReady = useCallback((readyEngine: EfxPaintEngine) => {
    canvasEngineReadyImplRef.current(readyEngine);
  }, []);
  const canvasCompletedMutationImplRef = useRef<(mutation: CompletedPaintMutation, mutationEngine: EfxPaintEngine) => void>(() => {});
  canvasCompletedMutationImplRef.current = (mutation, mutationEngine) => {
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
    const appFrame = acceptedTarget?.appFrame ?? currentFrame;
    const initialKeyId = acceptedTarget?.keyId ?? currentCellKeyId;
    const pendingFirstPaintTarget = pendingFirstPaintTargetRef.current;
    const liveAlphaCanvas = isEmpty ? null : mutationEngine.copyLiveAlphaCanvas();
    void (async () => {
      let keyId = initialKeyId;
      if (!keyId) {
        if (
          !pendingFirstPaintTarget
          || pendingFirstPaintTarget.launchOperationId !== launchContext.operationId
          || pendingFirstPaintTarget.layerId !== launchContext.layerId
          || pendingFirstPaintTarget.appFrame !== appFrame
        ) return;
        const firstPaintTarget = await pendingFirstPaintTarget.promise;
        if (!firstPaintTarget || firstPaintTarget.appFrame !== appFrame) return;
        keyId = firstPaintTarget.keyId;
      }

      const currentLaunch = launchContextRef.current;
      if (
        !currentLaunch
        || currentLaunch.operationId !== launchContext.operationId
        || currentLaunch.layerId !== launchContext.layerId
      ) return;
      const physicalRecord = physicPaintStore.getRotoRealKeyRecord(currentLaunch.layerId, keyId);
      if (!physicalRecord || physicalRecord.appFrame !== appFrame) return;
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
      if (!liveAlphaCanvas) return;
      const capturedBase = publicationIdentity?.cachedBase ?? null;
      const capturedBaseAppFrame = capturedBase?.appFrame ?? null;
      const cachedBase = publicationIdentity
        ? capturedBaseAppFrame === appFrame ? capturedBase : null
        : cachedBaseAppFrame === appFrame ? cachedRotoRepaintBaseFrame : null;
      const snapshotStartedAt = profilePerformance ? performance.now() : 0;
      const capture = rotoPersistence.captureLivePixels({
        layerId: publicationIdentity?.layerId ?? currentLaunch.layerId,
        operationId: publicationIdentity?.operationId,
        keyId: physicalRecord.keyId,
        appFrame,
        liveAlphaCanvas,
        cachedBase,
        background: publicationIdentity?.background,
        size: { width: canvasWidth, height: canvasHeight },
        mutationId,
      });
      if (profilePerformance) recordPhysicsPaintPerformance({ stage: 'snapshot-handoff', category: 'sync-cpu', durationMs: performance.now() - snapshotStartedAt, timestamp: performance.now(), mutationId, sourceFrame: appFrame });
      await capture;
    })().catch((error) => {
      console.error('[PhysicsPaintStudio] Automatic Roto pixel cache failed', error);
    }).finally(() => {
      if (pendingFirstPaintTargetRef.current === pendingFirstPaintTarget) {
        pendingFirstPaintTargetRef.current = null;
      }
    });
  };
  const handleCanvasCompletedMutation = useCallback((mutation: CompletedPaintMutation, mutationEngine: EfxPaintEngine) => {
    canvasCompletedMutationImplRef.current(mutation, mutationEngine);
  }, []);
  const cachedRotoPlaybackComposition = useMemo(() => launchContext ? {
    width: projectCanvasWidth,
    height: projectCanvasHeight,
    background: buildRotoBackgroundMetadata(settings),
  } : null, [launchContext?.operationId, projectCanvasWidth, projectCanvasHeight, settings.background, settings.paperGrain, settings.grainStrength]);
  const onionOverlay = useMemo(() => onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
    <img key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`} class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`} src={frame.dataUrl} style={{ opacity: getOnionFrameOpacity(frame.distance, onion.opacity) }} alt="" />
  )) : null, [onion.enabled, onion.opacity, onionPreviewFrames]);
  const rotoInputDisabledMessage = currentFrameIsGeneratedRoto
    ? `Generated frame ${currentFrame} is render-only.`
    : mutationLocked
      ? 'Finish the current Roto script operation.'
      : undefined;
  const canvasMount = canvasMountPropsMemo.resolve([canvasWidth, canvasHeight, paperTextureScale, handleCanvasEngineReady, setCanvasMounted, handleNativePenInputReady, handleCanvasCompletedMutation, recordEnginePerformance, rotoScript.prepareEngineDisposal, getStrokeMetadata], () => ({
    width: canvasWidth,
    height: canvasHeight,
    paperTextureScale,
    onEngineReady: handleCanvasEngineReady,
    onCanvasMounted: setCanvasMounted,
    onNativePenInputReady: handleNativePenInputReady,
    onCompletedMutation: handleCanvasCompletedMutation,
    onPerformanceSample: recordEnginePerformance,
    beforeEngineDestroy: rotoScript.prepareEngineDisposal,
    getStrokeMetadata,
  }));
  const canvasStack = canvasStackPropsMemo.resolve([cachedRotoReferenceUrl, rotoCachedPlayback.playbackTick, rotoCachedPlayback.isActive, cachedRotoPlaybackComposition, rotoInputDisabled, rotoInputDisabledMessage, beginRotoFrameEdit, onionOverlay, canvasKey, canvasMount], () => ({
    cachedRotoReferenceUrl,
    cachedRotoPlaybackTick: rotoCachedPlayback.playbackTick,
    cachedRotoPlaybackActive: rotoCachedPlayback.isActive,
    cachedRotoPlaybackComposition,
    inputDisabled: rotoInputDisabled,
    inputDisabledMessage: rotoInputDisabledMessage,
    onInputIntent: beginRotoFrameEdit,
    onionOverlay,
    canvasKey,
    mount: canvasMount,
  }));
  const viewModel = usePhysicsPaintStudioViewModel({
    layout,
    topBar,
    toolRail,
    canvas: canvasStack,
    rightPanel,
    playScriptDialog,
    workflow: {
        workflowLabel: launchContext?.workflowLabel,
        currentFrame, isPlaying, ready: readyToApply, occupiedRotoFrames: timelineOccupiedRotoFrames, savedRotoFrames: timelineSavedRotoFrames, cachedRotoFrames: timelineCachedRotoFrames,
        keyActionInFlight: rotoKeyUtilities.keyActionInFlight || rotoScriptNavigationLocked, mutationLocked, rotoCachedPlaybackAvailable, rotoCachedPlaybackStatus: rotoCachedPlayback.status, rotoCachedPlaybackLoop: rotoCachedPlayback.loop, rotoCachedPlaybackFps: rotoCachedPlayback.fps, projectFps: previewFps, isRotoCachedPlaybackActive: rotoCachedPlayback.isActive,
        // 38.1-D-01: the per-tick playback signal passes through as a signal
        // reference (never .value-read here); only the nav-pill current-frame
        // output child subscribes to it, during active playback only.
        rotoCachedPlaybackTick: rotoCachedPlayback.playbackTick,
        onToggleRotoPlayback: rotoCachedPlayback.toggle, onRotoPlaybackLoopChange: setRotoPlaybackLoop, onRotoPlaybackFpsChange: setRotoPlaybackFps, rotoInterpolationEnabled: rotoInterpolationState.enabled, rotoInterpolationMode: rotoInterpolationState.mode, rotoInterpolationPending: physicalEditCoordinator.pendingOperationId.value !== null,
        // 41-04 (D-12..D-14): session-local Audio Preview toggle. The .value
        // read subscribes this bundle like the sibling signal reads above; the
        // intent routes through the monitor funnel for immediate effect.
        audioPreviewEnabled: audioPreviewEnabled.value, onAudioPreviewToggle: handleAudioPreviewToggle,
        onRotoInterpolationEnabledChange: handleRotoInterpolationEnabledChange, onRotoInterpolationModeChange: handleRotoInterpolationModeChange,
        onDuplicateRotoKey: duplicateRotoKey, onAddRotoKey: addRotoKey, onInsertRotoFrame: rotoPhysicalActions.insertRotoFrame, onDeleteRotoFrame: rotoPhysicalActions.deleteRotoFrame, rotoPhysicalActions, onCopyRotoFrame: copyRotoFrame, onCutRotoFrame: cutRotoFrame, onPasteRotoFrame: pasteRotoFrame, rotoKeyRecords, rotoIncomingInterpolationBreakKeyIds, rotoPhysicalCells: rotoTimelineModel.physicalCells.value, rotoLoopResolutionContext: loopResolutionContext, rotoLoopPresentations: loopPresentations, selectedRotoLoopClipIds: effectiveSelectedLoopClipIds, onSelectRotoLoopClip: handleSelectRotoLoopClip, onOpenRotoLoopEdit: handleOpenRotoLoopEdit, rotoDragContextKey: launchContext ? `${launchContext.layerId}:${launchContext.operationId}` : 'none', hasCopiedRotoKey: rotoSession.copiedKey.value !== null, rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null },
        // Multi-selection gestures (37-04; D-01/D-02): keyId intents routed
        // through the pure 37-02 reducers over the store-ordered identity
        // list. Selection-only changes publish no status entry (UI-SPEC).
        rotoSelectedKeyIds: selectedKeyIds.value,
        rotoPrimarySelectedKeyId: selectedKeyId.value,
        rotoSpacingSelection: effectiveRotoSpacingSelection,
        onSelectRotoSpacingProxy: handleSelectRotoSpacingProxy,
        onClearRotoSpacingSelection: handleClearRotoSpacingSelection,
        onClearRotoKeySelection: handleClearRotoKeySelection,
        onToggleRotoKeySelection: handleToggleRotoKeySelection,
        onCollapseRotoSelectionToKey: handleCollapseRotoSelectionToKey,
        // Shift-click range selection (37-04; D-01): contiguous real-key range
        // from the anchor to the clicked key through the 37-02 range reducer.
        // Anchor fallback: a null anchor resolves to the current editing key.
        // The clicked key becomes current (flagged for 37-05 native UAT).
        onExtendRotoKeySelection: handleExtendRotoKeySelection,
        onSelectAllRotoKeys: selectAllRotoKeys,
        // Release-time group-drag reject publication (37-04; D-26): concise
        // UI-SPEC copy to the capsule (36.15 D-15 single-owner arbitration),
        // full resolver detail to the surviving diagnostic channel, mirroring
        // the coordinator's logDiagnostic console style.
        onRotoGroupDragRejected: handleRotoGroupDragRejected,
        rotoScript,
        statusMessage: isPlaying ? `Previewing ${rotoPlaybackFrameIndex.peek() + 1} / ${rotoPlaybackFrameCount.peek()}` : (applyStatus !== 'success' ? applyMessage : null), onion, onionPreviewFrames, showOnionHiddenDuringPreview: onion.enabled && isPlaying,
        onNavigateToSyncedFrame: handleNavigateToSyncedFrame, onGoToFirstFrame: handleGoToFirstFrame, onGoToPreviousFrame: handleGoToPreviousFrame, onGoToNextFrame: handleGoToNextFrame, onGoToLastFrame: handleGoToLastFrame, onOnionChange: setOnion, onClose: handleWorkflowClose,
      },
    status: { shortcutsVisible },
  });
  return <PhysicsPaintStudioView {...viewModel} />;
}

async function dispatchAndWaitForAcceptedRotoPhysicalEdit<T extends { operationId: string }>(
  pendingOperationId: {
    peek: () => string | null;
    subscribe: (listener: (operationId: string | null) => void) => () => void;
  },
  acceptedOutput: { peek: () => T | null },
  dispatch: () => Promise<boolean>,
): Promise<T | null> {
  let expectedOperationId = pendingOperationId.peek();
  const unsubscribe = pendingOperationId.subscribe((operationId) => {
    if (expectedOperationId === null && operationId !== null) expectedOperationId = operationId;
  });
  try {
    if (!await dispatch() || expectedOperationId === null) return null;
    const deadline = performance.now() + 5_500;
    while (performance.now() < deadline) {
      const accepted = acceptedOutput.peek();
      if (accepted?.operationId === expectedOperationId) return accepted;
      if (pendingOperationId.peek() === null) return null;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
    const accepted = acceptedOutput.peek();
    return accepted?.operationId === expectedOperationId ? accepted : null;
  } finally {
    unsubscribe();
  }
}
