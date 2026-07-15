import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const viewPath = fileURLToPath(new URL('./view/PhysicsPaintStudioView.tsx', import.meta.url));
const topBarPath = fileURLToPath(new URL('./view/PhysicsPaintTopBar.tsx', import.meta.url));
const stylePath = fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url));
const bridgePath = fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url));
const enginePath = fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts', import.meta.url));
const rotoSessionPath = fileURLToPath(new URL('./roto/physicsPaintRotoSession.ts', import.meta.url));
const rotoNavigationCoordinatorPath = fileURLToPath(new URL('./hooks/useRotoNavigationCoordinator.ts', import.meta.url));
const rotoKeyUtilitiesPath = fileURLToPath(new URL('./hooks/useRotoKeyUtilities.ts', import.meta.url));
const rotoReferenceControllerPath = fileURLToPath(new URL('./hooks/useRotoReferenceController.ts', import.meta.url));
const rotoCacheTransactionsPath = fileURLToPath(new URL('./roto/rotoCacheTransactions.ts', import.meta.url));
const rotoLaunchHydrationPath = fileURLToPath(new URL('./roto/rotoLaunchHydration.ts', import.meta.url));
const rotoSaveTransactionsPath = fileURLToPath(new URL('./roto/rotoSaveTransactions.ts', import.meta.url));
const rotoPersistenceCoordinatorPath = fileURLToPath(new URL('./hooks/useRotoFramePersistenceCoordinator.ts', import.meta.url));
const rotoPersistenceIntegrationPath = fileURLToPath(new URL('./hooks/useRotoPersistenceIntegration.ts', import.meta.url));
const rotoFrameEditingControllerPath = fileURLToPath(new URL('./hooks/useRotoFrameEditingController.ts', import.meta.url));
const rotoEditBufferControllerPath = fileURLToPath(new URL('./hooks/useRotoEditBufferController.ts', import.meta.url));
const rotoEditBufferTransactionsPath = fileURLToPath(new URL('./roto/rotoEditBufferTransactions.ts', import.meta.url));
const playFrameTransactionsPath = fileURLToPath(new URL('./play/playFrameTransactions.ts', import.meta.url));
const playEditCacheControllerPath = fileURLToPath(new URL('./hooks/usePlayEditCacheController.ts', import.meta.url));
const playPreviewControllerPath = fileURLToPath(new URL('./hooks/usePlayPreviewController.ts', import.meta.url));
const playLifecycleTransactionsPath = fileURLToPath(new URL('./play/playLifecycleTransactions.ts', import.meta.url));
const playCoordinatorPath = fileURLToPath(new URL('./hooks/usePhysicsPaintPlayCoordinator.ts', import.meta.url));
const rotoPlayConversionTransactionsPath = fileURLToPath(new URL('./roto/rotoPlayConversionTransactions.ts', import.meta.url));
const rotoPlayConversionControllerPath = fileURLToPath(new URL('./hooks/useRotoPlayConversionController.ts', import.meta.url));
const engineLifecyclePath = fileURLToPath(new URL('./engine/usePhysicsPaintEngineLifecycle.ts', import.meta.url));
const sessionControllerPath = fileURLToPath(new URL('./hooks/usePhysicsPaintSessionController.ts', import.meta.url));
const canvasMountPath = fileURLToPath(new URL('./engine/PhysicsPaintCanvasMount.tsx', import.meta.url));
const onionPreviewPath = fileURLToPath(new URL('./roto/rotoOnionPreview.ts', import.meta.url));
const studioSelectorsPath = fileURLToPath(new URL('./view/physicsPaintStudioSelectors.ts', import.meta.url));
const playLimitToastPath = fileURLToPath(new URL('./hooks/usePlayLimitToast.ts', import.meta.url));
const canvasSizingPath = fileURLToPath(new URL('./engine/physicsPaintCanvasSizing.ts', import.meta.url));
const parentBridgePath = fileURLToPath(new URL('./bridge/usePhysicsPaintParentBridge.ts', import.meta.url));
const launchContextPath = fileURLToPath(new URL('./bridge/physicsPaintLaunchContext.ts', import.meta.url));
const rotoCanvasFramesPath = fileURLToPath(new URL('./roto/rotoCanvasFrames.ts', import.meta.url));
const studioKeyboardPath = fileURLToPath(new URL('./view/physicsPaintStudioKeyboard.ts', import.meta.url));
const launchIntegrationPath = fileURLToPath(new URL('./hooks/usePhysicsPaintLaunchIntegration.ts', import.meta.url));
const applyResultIntegrationPath = fileURLToPath(new URL('./hooks/usePhysicsPaintApplyResultController.ts', import.meta.url));
const workflowIntegrationPath = fileURLToPath(new URL('./hooks/usePhysicsPaintWorkflowIntegration.ts', import.meta.url));
const interpolationControllerPath = fileURLToPath(new URL('./hooks/useRotoInterpolationController.ts', import.meta.url));
function studioPresentationSource(): string {
  const studio = readFileSync(sourcePath, 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  const normalizedProps = studio
    .replace(/\b([A-Za-z]\w*): ([^,\n]+)/g, '$1={$2}')
    .replace(/\b([A-Za-z]\w*),/g, '$1={$1}');
  return `${studio}\n${view}\n${normalizedProps}\n{shortcutsVisible`;
}
const rotoNavigationCoordinatorSource = () => readFileSync(rotoNavigationCoordinatorPath, 'utf8');
const source = () => `${rotoPersistenceIntegrationSource()}\n${rotoFrameEditingControllerSource()}\n${studioPresentationSource()}
${rotoNavigationCoordinatorSource()}\n${rotoPersistenceCoordinatorSource()}\n${rotoReferenceControllerSource()}\n${rotoSaveTransactionsSource()}\n${rotoEditBufferControllerSource()}\n${rotoEditBufferTransactionsSource()}\n${playCoordinatorSource()}\n${playFrameTransactionsSource()}\n${playEditCacheControllerSource()}\n${playPreviewControllerSource()}\n${playLifecycleTransactionsSource()}\n${engineLifecycleSource()}\n${canvasMountSource()}\n${canvasSizingSource()}\n${readFileSync(launchIntegrationPath, 'utf8')}\n${readFileSync(applyResultIntegrationPath, 'utf8')}\n${readFileSync(workflowIntegrationPath, 'utf8')}\n${readFileSync(interpolationControllerPath, 'utf8')}\n${sessionControllerSource()}\n${rotoPlayConversionControllerSource()}\n${rotoCacheTransactionsSource()}\n${rotoLaunchHydrationSource()}`.split("from '../").join("from './");
const topBarSource = () => readFileSync(topBarPath, 'utf8');
const styles = () => readFileSync(stylePath, 'utf8');
const bridgeSource = () => readFileSync(bridgePath, 'utf8');
const engineSource = () => readFileSync(enginePath, 'utf8');
const rotoSessionSource = () => readFileSync(rotoSessionPath, 'utf8');
const rotoKeyUtilitiesSource = () => readFileSync(rotoKeyUtilitiesPath, 'utf8');
const rotoReferenceControllerSource = () => readFileSync(rotoReferenceControllerPath, 'utf8');
const rotoCacheTransactionsSource = () => readFileSync(rotoCacheTransactionsPath, 'utf8');
const rotoLaunchHydrationSource = () => readFileSync(rotoLaunchHydrationPath, 'utf8');
const rotoSaveTransactionsSource = () => readFileSync(rotoSaveTransactionsPath, 'utf8');
const rotoPersistenceCoordinatorSource = () => readFileSync(rotoPersistenceCoordinatorPath, 'utf8');
const rotoPersistenceIntegrationSource = () => readFileSync(rotoPersistenceIntegrationPath, 'utf8')
  .split('input.launchContext').join('launchContext')
  .split('input.reference.cachedRepaintBaseFrame').join('cachedRotoRepaintBaseFrame')
  .split('rotoCachedPlayback.stop()').join('rotoCachedPlayback.stop()')
  .split('input.reference.clearUrl()').join('clearCachedRotoReferenceUrl()')
  .split('input.navigation.playback.stop()').join('rotoCachedPlayback.stop()')
  .split('input.reference.setUrl(null)').join('setCachedRotoReferenceUrl(null)')
  .split('input.status.setSavingFrame(effect.frame)').join('setRotoSavingFrame(effect.frame)')
  .split('input.frame.snapshotCurrent()').join('snapshotCurrentRotoFrame()')
  .split('input.lifecycle.flushInFlightRef.current').join('rotoFlushInFlightRef.current')
  .split('input.status.applyStatus').join('applyStatus')
  .split('input.frame.setLaunchContext').join('setLaunchContext')
  .split('input.action.bridgeMode').join('bridgeMode')
  .split('input.reference.loadFrame').join('loadCachedRotoReferenceFrame')
  .split('input.engine').join('engine')
  .split('input.frame.current').join('currentFrame')
  .split('input.editBuffer.frameStatesRef').join('rotoFrameStatesRef')
  .split('input.lifecycle.saveOnLeaveSourceFrameRef').join('saveOnLeaveSourceFrameRef')
  .split('input.lifecycle.activeOperationIdRef').join('activeOperationIdRef')
  .split('input.lifecycle.pendingAdvanceRef').join('pendingRotoAdvanceRef')
  .split('input.status.setApplyStatus').join('setApplyStatus')
  .split('input.status.setApplyMessage').join('setApplyMessage')
  .split('const openFrame = useCallback').join('const navigateToSyncedFrame = useCallback')
  .split('const openAfterSave = useCallback').join('const openSyncedRotoFrameAfterSave = useCallback')
  .split('const applyKeyFrames = useCallback').join('const applyRotoKeyFrames = useCallback')
  .split('const persistKeyFrameTransaction = useCallback').join('const persistRotoKeyFrameTransaction = useCallback')
  .split('const restoreFrame = useCallback').join('const restoreRotoFrameFromSessionEffect = useCallback');
const rotoFrameEditingControllerSource = () => readFileSync(rotoFrameEditingControllerPath, 'utf8')
  .split('input.workflowMode').join('workflowMode')
  .split('input.currentFrame').join('currentFrame')
  .split('input.engine').join('engine')
  .split('input.reference.cachedRepaintBaseFrame').join('cachedRotoRepaintBaseFrame')
  .split('input.reference.cachedReferenceUrl').join('cachedRotoReferenceUrl')
  .split('input.reference.clearReference()').join('clearCachedRotoReferenceUrl()')
  .split('input.editBuffer.markDirty(currentFrame)').join('rotoEditBuffer.markDirty(appFrame)')
  .split('input.editBuffer.snapshotFrame').join('rotoEditBuffer.snapshotFrame')
  .split('input.session.markLiveOverlayEmpty').join('rotoSession.markLiveOverlayEmpty')
  .split('input.session.markLiveOverlayDirty').join('rotoSession.markLiveOverlayDirty')
  .split('input.editBuffer.clearCachedOverlay').join('rotoEditBuffer.clearCachedOverlay')
  .split('input.editBuffer.clearFrame').join('rotoEditBuffer.clearFrame')
  .split('const beginFrameEdit = useCallback').join('const beginRotoFrameEdit = useCallback')
  .split('const markCurrentFrameDirty = useCallback').join('const markCurrentRotoFrameDirty = useCallback')
  .split('input.currentFrameIsGenerated').join('currentFrameIsGeneratedRoto')
  .split('input.reference.setReferenceUrl').join('setCachedRotoReferenceUrl');
const rotoEditBufferControllerSource = () => readFileSync(rotoEditBufferControllerPath, 'utf8');
const rotoEditBufferTransactionsSource = () => readFileSync(rotoEditBufferTransactionsPath, 'utf8');
const playFrameTransactionsSource = () => readFileSync(playFrameTransactionsPath, 'utf8');
const playEditCacheControllerSource = () => readFileSync(playEditCacheControllerPath, 'utf8');
const playPreviewControllerSource = () => readFileSync(playPreviewControllerPath, 'utf8');
const playLifecycleTransactionsSource = () => readFileSync(playLifecycleTransactionsPath, 'utf8');
const playCoordinatorSource = () => readFileSync(playCoordinatorPath, 'utf8');
const rotoPlayConversionTransactionsSource = () => readFileSync(rotoPlayConversionTransactionsPath, 'utf8');
const rotoPlayConversionControllerSource = () => readFileSync(rotoPlayConversionControllerPath, 'utf8');
const engineLifecycleSource = () => readFileSync(engineLifecyclePath, 'utf8');
const sessionControllerSource = () => readFileSync(sessionControllerPath, 'utf8');
const canvasMountSource = () => readFileSync(canvasMountPath, 'utf8');
const canvasSizingSource = () => readFileSync(canvasSizingPath, 'utf8');
const parentBridgeSource = () => readFileSync(parentBridgePath, 'utf8');
const launchContextSource = () => readFileSync(launchContextPath, 'utf8');
const rotoCanvasFramesSource = () => readFileSync(rotoCanvasFramesPath, 'utf8');
const studioKeyboardSource = () => readFileSync(studioKeyboardPath, 'utf8');

describe('PhysicsPaintStudio refactor regression ownership contract', () => {
  it('keeps manual Roto selection canonical across frame-sync launch echoes', () => {
    expect(studioPresentationSource()).toContain('pendingFrameSyncRef');
    expect(rotoPersistenceIntegrationSource()).toContain('input.lifecycle.pendingFrameSyncRef.current = frame');
    const launch = readFileSync(launchIntegrationPath, 'utf8');
    expect(launch).toContain('const pendingFrame = input.lifecycle.pendingFrameSyncRef.current');
    expect(launch).toContain('startFrame: pendingFrame');
  });

  it('keeps cached Roto playback transient and freezes editable utility projection', () => {
    const studio = studioPresentationSource();
    const playbackStart = studio.indexOf('playback: {');
    const playbackBlock = studio.slice(playbackStart, studio.indexOf('const rotoKeyUtilities', playbackStart));
    expect(playbackBlock).not.toContain('setLaunchContext');
    expect(studio).toContain('rotoPlaybackActive: rotoCachedPlayback.isActive');
  });

  it('persists interpolation disable before syncing a remapped frame', () => {
    const controller = readFileSync(interpolationControllerPath, 'utf8');
    expect(controller).toContain('const updateRotoInterpolationSettings = useCallback(async');
    expect(controller.indexOf('await input.sendApplyPayload')).toBeGreaterThan(-1);
    expect(controller.indexOf('await input.sendFrameSync')).toBeGreaterThan(controller.indexOf('await input.sendApplyPayload'));
  });
});

describe('PhysicsPaintStudio Roto session boundary contract', () => {
  it('keeps real-key utility transactions pixel/preview based without durable editable state', () => {
    const utilities = rotoKeyUtilitiesSource();
    const integration = rotoPersistenceIntegrationSource();

    expect(utilities).toContain('getPreviewFrames');
    expect(utilities).toContain('applyRotoKeyFrames');
    expect(utilities).not.toContain('getEditableStates');
    expect(utilities).not.toContain('setEditableStates');
    expect(utilities).not.toContain('getEditableState');
    expect(integration).not.toContain('handleSaveFrameEffect');
  });

  it('navigates immediately without save-before-navigation effects', () => {
    const navigation = rotoNavigationCoordinatorSource();
    const session = rotoSessionSource();

    expect(navigation).toContain('return runtimePortRef.current.navigateToSyncedFrame(targetFrame)');
    expect(navigation).not.toContain('saveFrame');
    expect(session).not.toContain("type: 'saveFrame'");
    expect(session).not.toContain('savingFrame');
    expect(session).not.toContain('pendingNavigationFrame');
  });
});

describe('PhysicsPaintStudio extracted utility boundaries', () => {
  it('wires adjacent accessible Undo and Redo rail actions through existing callbacks', () => {
    const studio = readFileSync(sourcePath, 'utf8');
    const rail = readFileSync(fileURLToPath(new URL('./view/PhysicsPaintToolRail.tsx', import.meta.url)), 'utf8');
    expect(rail.indexOf("id: 'redo'")).toBeGreaterThan(rail.indexOf("id: 'undo'"));
    expect(rail).toContain("label: 'Redo'");
    expect(rail).toContain("if (item.id === 'redo') onRedo()");
    expect(studio).toContain('onUndo: undo, onRedo: redo');
  });

  it('keeps shortcut filtering pure and wired through the keyboard module', () => {
    const studio = readFileSync(sourcePath, 'utf8');
    const keyboard = studioKeyboardSource();

    expect(studio).toContain("import { usePhysicsPaintStudioKeyboard } from './hooks/usePhysicsPaintStudioKeyboard'");
    expect(studio).toContain('const handlePhysicsPaintKeyDown = usePhysicsPaintStudioKeyboard({');
    expect(studio).not.toContain('if (!isPhysicsPaintShortcutTarget(event.target)) return;');
    expect(studio).not.toContain('function isPhysicsPaintShortcutTarget');
    expect(keyboard).toContain('export function isPhysicsPaintShortcutTarget(target: EventTarget | null): boolean');
    expect(keyboard).not.toContain('useEffect');
  });

  it('owns Roto canvas/frame construction in the cohesive Roto module while Studio keeps call-site wiring', () => {
    const studio = readFileSync(sourcePath, 'utf8');
    const canvasFrames = rotoCanvasFramesSource();

    expect(studio).toContain("from './roto/rotoCanvasFrames'");
    expect(studio).toContain('buildBlankRotoFrame(canvasWidth, canvasHeight, frame)');
    expect(rotoFrameEditingControllerSource()).toContain('buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), currentFrame');
    for (const helper of ['addOccupiedRotoFrame', 'exportTransparentStrokeCanvas', 'buildRotoFrameFromCanvas', 'drawCanvasAtSize', 'buildBlankRotoFrame', 'buildRotoOutputFrame']) {
      expect(canvasFrames).toContain(`export function ${helper}`);
      expect(studio).not.toContain(`function ${helper}`);
    }
    expect(canvasFrames).toContain('export type RenderedFramePayload');
  });
});

describe('PhysicsPaintStudio Play/Roto conversion boundary contract', () => {
  it('moves conversion payload plans and bridge lifecycle into the focused controller', () => {
    const text = source();
    const transactions = rotoPlayConversionTransactionsSource();
    const controller = rotoPlayConversionControllerSource();

    expect(text).toContain("from './hooks/useRotoPlayConversionController'");
    expect(text).toContain('const conversionActions = useRotoPlayConversionController(input.conversion)');
    expect(readFileSync(sourcePath, 'utf8')).not.toContain('const convertPlayToRoto = useCallback');
    expect(readFileSync(sourcePath, 'utf8')).not.toContain('const convertRotoToPlay = useCallback');
    expect(transactions).toContain('PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE');
    expect(transactions).toContain("kind: 'convert-play-to-roto'");
    expect(transactions).toContain("kind: 'convert-roto-to-play'");
    expect(controller).toContain('input.registerPendingApply(payload)');
    expect(controller).toContain('input.startApplyTimeout(payload.operationId)');
    expect(controller).toContain('input.clearActiveApply()');
  });

  it('preserves conversion storage, cache reset, workflow, and metadata ownership in the bridge controller', () => {
    const controller = rotoPlayConversionControllerSource();
    const transactions = rotoPlayConversionTransactionsSource();

    for (const call of ['input.setFrame(', 'input.setEditableState(', 'input.removeFrameRange(', 'input.resetLatestPlayFrames()', 'input.resetPlayPreview()', 'input.markPlayCacheDirty()', 'input.resetPlayFrameEdits()', "input.setWorkflowMode('roto')", "input.setWorkflowMode('play')"]) {
      expect(controller).toContain(call);
    }
    for (const field of ['selectedPlayScriptId', 'playMotion', 'playRenderOptions', 'previewFrame: 0', 'cachedRotoFrames']) {
      expect(transactions).toContain(field);
    }
  });
});

describe('PhysicsPaintStudio external engine lifecycle boundary contract', () => {
  it('moves engine, canvas, tablet, restore, render synchronization, and cleanup ownership into focused modules', () => {
    const studio = readFileSync(sourcePath, 'utf8');
    const lifecycle = engineLifecycleSource();
    const canvasMount = canvasMountSource();

    expect(studio).toContain("from './engine/usePhysicsPaintEngineLifecycle'");
    expect(readFileSync(viewPath, 'utf8')).toContain("from '../engine/PhysicsPaintCanvasMount'");
    expect(studio).toContain('const { engine, engineRef, canvasMounted, setCanvasMounted, handleEngineReady, handleNativePenInputReady } = usePhysicsPaintEngineLifecycle({');
    expect(studio).not.toContain("eventApi.listen<{ pressure: number; tilt_x: number; tilt_y: number }>('tablet:pressure'");
    expect(lifecycle).toContain('engineRef.current = engine');
    expect(lifecycle).toContain("eventApi.listen<{ pressure: number; tilt_x: number; tilt_y: number }>('tablet:pressure'");
    expect(lifecycle).toContain('engine.load(resizePhysicsPaintState(input.launchContext.editableState, input.canvasWidth, input.canvasHeight))');
    expect(lifecycle).toContain('applyRotoBackgroundMetadataToEngine(engine, input.launchContext.rotoBackground)');
    expect(lifecycle).toContain('applyPlayRenderOptionsToEngine(engine, input.launchContext.playRenderOptions)');
    expect(lifecycle).toContain('useEffect(() => input.clearExternalState, [])');
    expect(canvasMount).toContain('<EfxPaintCanvas');
    expect(canvasMount).toContain("const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas'");
  });
});

describe('PhysicsPaintStudio onion preview contract', () => {
  it('keeps onion overlays and paper/background outside the automatic alpha cache', () => {
    const text = studioPresentationSource();
    const canvas = canvasMountSource();
    const onion = readFileSync(onionPreviewPath, 'utf8');

    expect(canvas).toContain('onCompletedMutation');
    expect(text).toContain('mutationEngine.copyLiveAlphaCanvas()');
    expect(text).toContain('cachedBase');
    expect(text).toContain('useRotoBackgroundMetadataSync({ launchContext, workflowMode, settings });');
    expect(onion).toContain("if (frame.source && frame.source !== 'real-key') return;");
    expect(onion).toContain('if (frame.backgroundOnly) return;');
  });

  it('keeps the measured canvas bounds and onion controls intact', () => {
    const text = studioPresentationSource();
    const mount = canvasMountSource();
    expect(mount).toContain('setDisplaySize(getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height))');
    expect(text).toContain('class="physics-paint-onion-overlay canvas-region"');
    expect(text).toContain('opacity: Math.round(paintStore.onionSkinOpacity.value * 100)');
  });
});

describe('PhysicsPaintStudio top bar controls contract', () => {
  it('uses a wider brush-size slider with an exact numeric input on the same change path', () => {
    const topBar = topBarSource();
    const css = styles();

    expect(topBar).toContain('function clampTopBarValue');
    expect(topBar).toContain('numericInput?: boolean');
    expect(topBar).toContain('class="physics-paint-topbar-number"');
    expect(topBar).toContain('aria-label={`${props.label} exact value`}');
    expect(topBar).toContain('onInput={(event) => updateValue((event.target as HTMLInputElement).value)}');
    expect(topBar).toContain('onChange={onBrushSizeChange} numericInput');
    expect(css).toContain('.physics-paint-topbar-slider.exact');
    expect(css).toContain('width: 132px');
  });

  it('keeps save/load/apply feedback out of the top header', () => {
    const topBar = topBarSource();

    expect(topBar).not.toContain('applyMessage');
    expect(topBar).not.toContain('physics-paint-topbar-meta');
    expect(topBar).not.toContain('physics-paint-apply-copy');
  });
});

describe('PhysicsPaintStudio Roto cache relaunch contract', () => {
  it('derives saved and occupied Roto cells from the timeline adapter after reopen', () => {
    const text = source();
    const workflowStripStart = text.indexOf('    workflow: {');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).not.toContain('function getRealCachedRotoFrames(context: PhysicPaintLaunchContext | null)');
    expect(text).toContain('selectProjectedRealCachedRotoFrames');
    expect(text).not.toContain('function getSavedRotoMarkersFromLaunchContext(context: PhysicPaintLaunchContext | null)');
    expect(text).not.toContain('useState<PhysicsPaintWorkflowStripFrameMarker[]>(() => getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).not.toContain('useState<number[]>(() => getRealCachedRotoDisplayFrameNumbers(launchContext))');
    expect(text).not.toContain('setSavedRotoFrames(getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).not.toContain('setOccupiedRotoFrames(getRealCachedRotoDisplayFrameNumbers(launchContext))');
    expect(text).toContain('const rotoTimelineModel = useRotoTimelineModel');
    expect(text).toContain('const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value');
    expect(text).toContain('const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value');
    expect(workflowStripBlock).toContain('occupiedRotoFrames: timelineOccupiedRotoFrames');
    expect(workflowStripBlock).toContain('savedRotoFrames: timelineSavedRotoFrames');
    expect(workflowStripBlock).toContain('cachedRotoFrames: timelineCachedRotoFrames');
  });

  it('keeps cached Roto playback scoped to session display frames including generated cache frames', () => {
    const text = source();
    const playbackBlock = text.slice(text.indexOf('function findCachedRotoPlaybackFrame'), text.indexOf('useEffect(() => {', text.indexOf('function findCachedRotoPlaybackFrame')));

    expect(text).toContain('getFrame: findCachedRotoDisplayFrame');
    expect(rotoNavigationCoordinatorSource()).toContain('keyUtilities.session.playbackFrameNumbers.value.map');
    expect(text).toContain('getFrame: findCachedRotoDisplayFrame');
    expect(playbackBlock).not.toContain('return getRealCachedRotoDisplayFrameNumbers(launchContext)');
    expect(playbackBlock).not.toContain('filter((entry): entry is { appFrame: number; frame: RenderedFramePayload } => Boolean(entry.frame))');
    expect(playbackBlock).not.toContain('buildTransientRotoBackgroundFrame');
    expect(playbackBlock).not.toContain('frames.add(currentFrame)');
    expect(playbackBlock).not.toContain('occupiedRotoFrames.forEach');
    expect(playbackBlock).not.toContain('savedRotoFrames.forEach');
  });

  it('delegates cached Roto reference loading to a focused controller without installing cached pixels as paper background', () => {
    const text = source();
    const controller = rotoReferenceControllerSource();

    expect(text).toContain("from './hooks/useRotoFramePersistenceCoordinator'");
    expect(text).toContain('const reference = useRotoReferenceController<RenderedFramePayload>({');
    expect(controller).toContain('input.setReferenceUrl(null)');
    expect(controller).toContain('engine.setBgMode(input.getSettingsBackground())');
    expect(controller).toContain('engine.setPreviewBaseImageUrl(cachedFrame.dataUrl)');
    expect(controller).toContain('engine.clearPreviewBaseImage()');
    expect(controller).toContain('engine.resetBackground()');
    expect(controller).toContain('engine.clear()');
    expect(controller).not.toContain('setBackgroundImageUrl');
    expect(text).toContain('const resetRotoSessionForLaunch = useCallback');
    expect(text).toContain('resetRotoSessionForLaunch(hydratedContext)');
    expect(text).toContain('input.loadCachedReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine)');
    expect(text).toContain("if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine)");
    expect(styles()).toContain('.physics-paint-cached-roto-reference');
  });
});

describe('PhysicsPaintStudio Play relaunch hydration contract', () => {
  it('initializes workflow mode and Play range from launch context metadata instead of hardcoded Roto defaults', () => {
    const text = source();

    expect(text).toContain("context?.workflowMode === 'play' || context?.editableSource === 'play'");
    expect(text).toContain('useState<PhysicsPaintWorkflowMode>(() => getLaunchWorkflowMode(launchContext))');
    expect(text).toContain('launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES');
    expect(text).toContain('const currentFrame = launchContext?.startFrame ?? 0');
    expect(text).not.toContain("useState<PhysicsPaintWorkflowMode>('roto')");
    expect(text).not.toContain('useState(4)');
  });

  it('restores saved Roto paper metadata from launch context without using Play render options', () => {
    const text = source();

    const settings = readFileSync(fileURLToPath(new URL('./engine/physicsPaintStudioSettings.ts', import.meta.url)), 'utf8');
    const lifecycle = readFileSync(fileURLToPath(new URL('./engine/usePhysicsPaintEngineLifecycle.ts', import.meta.url)), 'utf8');

    expect(settings).toContain('export function applyRotoBackgroundMetadataToSettings(metadata: PhysicPaintRotoBackgroundMetadata): PhysicsPaintStudioSettings');
    expect(text).toContain("if (getLaunchWorkflowMode(launch) === 'roto' && launch.rotoBackground) return applyRotoBackgroundMetadataToSettings(launch.rotoBackground)");
    expect(settings).toContain('export function applyRotoBackgroundMetadataToEngine(engine: EfxPaintEngine, metadata: PhysicPaintRotoBackgroundMetadata): void');
    expect(settings).toContain('engine.setBgMode(metadata.background)');
    expect(settings).toContain('engine.setPaperGrain(metadata.paperGrain)');
    expect(settings).toContain('engine.setEmbossStrength(metadata.grainStrength)');
    expect(lifecycle).toContain("if (getLaunchWorkflowMode(input.launchContext) === 'roto' && input.launchContext?.rotoBackground)");
  });

  it('fetches the stored Tauri launch context after mount so editable Play state and cached frames are not lost on reopen', () => {
    const text = source();
    const bridge = parentBridgeSource();
    const launch = launchContextSource();

    expect(bridge).toContain("coreApi.invoke('get_physics_paint_launch_context')");
    expect(bridge).toContain('isPhysicPaintLaunchContext(storedContext)');
    expect(text).toContain('const applyIncomingLaunchContext = useCallback');
    expect(bridge).toContain('applyIncomingLaunchContextRef.current(storedContext)');
    expect(bridge).toContain('applyIncomingLaunchContextRef.current(event.payload)');
    expect(bridge).toContain('applyIncomingLaunchContextRef.current = applyIncomingLaunchContext');
    expect(launch).toContain("setters.setSavedPlayCacheDirty(getLaunchWorkflowMode(context) === 'play' && context.playCacheStatus !== 'cached')");
  });

  it('accepts saved Play source metadata through the parsed launch context path', () => {
    const text = launchContextSource();

    expect(text).toContain('workflowMode: workflowMode === \'play\' ? \'play\' : \'roto\'');
    expect(text).toContain('playStartFrame: Number.isInteger(playStartFrame) && playStartFrame >= 0 ? playStartFrame : undefined');
    expect(text).toContain('playFrameCount: Number.isInteger(playFrameCount) && playFrameCount > 0 ? playFrameCount : undefined');
    expect(text).toContain('editableSource: editableSource === \'play\' ? \'play\' : editableSource === \'roto\' ? \'roto\' : undefined');
    expect(text).toContain('const parsed = JSON.parse(encodedContext)');
    expect(text).not.toContain('JSON.parse(decodeURIComponent(encodedContext))');
  });

  it('keeps Play frame conversion availability separate from cleared onion preview state', () => {
    const text = source();

    expect(playEditCacheControllerSource()).toContain('const [framesVersion, setFramesVersion] = useState(0)');
    expect(playEditCacheControllerSource()).toContain('latestFramesRef.current = frames');
    expect(playCoordinatorSource()).toContain('editCache.setLatestFrames(frames)');
    expect(playEditCacheControllerSource()).toContain('setFramesVersion((version) => version + 1)');
    expect(readFileSync(studioSelectorsPath, 'utf8')).toContain('new Set(input.latestFrames.map((frame) => frame.appFrame))');
    expect(text).toContain('selectPlayConversionMissingFrames({');
  });
});

describe('PhysicsPaintStudio local Play preview contract', () => {
  it('initializes local preview frame from saved Play launch context', () => {
    const text = source();

    expect(playEditCacheControllerSource()).toContain('const [localPreviewFrame, setLocalPreviewFrameState]');
    expect(playFrameTransactionsSource()).toContain('const previewFrame = context?.previewFrame');
    expect(launchContextSource()).toContain('setters.setLocalPlayPreviewFrame(getLaunchPlayPreviewFrame(context))');
    expect(text).toContain('currentPreviewFrame={localPlayPreviewFrame}');
  });

  it('keeps local Play scrub separate from editor frame sync', () => {
    const text = source();
    const localPreviewBlock = playEditCacheControllerSource();

    expect(localPreviewBlock).toContain('setLocalPreviewFrame(previewFrame)');
    expect(localPreviewBlock).toContain('loadCachedPreviewFrame(previewFrame)');
    expect(localPreviewBlock).not.toContain('sendPhysicPaintFrameSyncMessage');
    expect(text).toContain('onPreviewPlayFrame={previewLocalPlayFrame}');
    expect(text).not.toContain('onInspectPlayFrame={navigateToSyncedFrame}');
  });

  it('uses cached saved Play frames while clean and switches to live preview after clear/remake', () => {
    const text = source();

    expect(playEditCacheControllerSource()).toContain('const [cacheDirty, setCacheDirty]');
    expect(playEditCacheControllerSource()).toContain('const loadCachedPreviewFrame = useCallback');
    expect(playEditCacheControllerSource()).toContain('const getCachedFramesForRange = useCallback');
    expect(playPreviewControllerSource()).toContain('const cachedTimerRef = useRef<number | null>(null)');
    expect(playPreviewControllerSource()).toContain('Previewing cached ${safeFrameCount} frames at ${input.previewFps} fps.');
    expect(playFrameTransactionsSource()).toContain('input.latestFrames.find((frame) => frame.appFrame === appFrame)');
    expect(playFrameTransactionsSource()).toContain('input.context.cachedPlayFrames?.find((frame) => frame.appFrame === appFrame)');
    expect(playFrameTransactionsSource()).toContain('input.getStoredFrame(input.context.layerId, appFrame)');
    expect(playEditCacheControllerSource()).toContain('setCachedPreviewUrl(cachedFrame?.dataUrl ?? null)');
    expect(playEditCacheControllerSource()).toContain('if (cacheDirty)');
    expect(text).toContain('editCache.setCachedPreviewUrl(null)');
    expect(text).toContain('editCache.setCacheDirty(true)');
    expect(text).toContain('markSelectedPlayCacheDirty');
  });

  it('passes launch gap limits into the fixed Play mode so frame 11 can clamp to one visible cell', () => {
    const text = source();
    const workflowStripStart = text.indexOf('    workflow: {');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(sessionControllerSource()).toContain('function makeLoadedPlayLaunchContext');
    expect(sessionControllerSource()).toContain('delete next.maxPlayFrameCount');
    expect(sessionControllerSource()).toContain('delete next.maxPlayFrameCountReason');
    expect(sessionControllerSource()).toContain('makeLoadedPlayLaunchContext(current, frameCount, previewFrame)');
    expect(workflowStripBlock).toContain('maxPlayFrameCount: launchContext?.maxPlayFrameCount');
    expect(workflowStripBlock).toContain('maxPlayFrameCountReason: launchContext?.maxPlayFrameCountReason');
    expect(workflowStripBlock).toContain('onPlayLimit: playLimitToast.show');
    expect(workflowStripBlock).toContain('startFrame: launchContext?.startFrame ?? 0');
    expect(workflowStripBlock).not.toContain("maxPlayFrameCount={workflowMode === 'play' ? undefined");
  });

  it('surfaces Play duration bound warnings as a dismissible top-canvas toast', () => {
    const text = source();

    const toastHook = readFileSync(playLimitToastPath, 'utf8');
    expect(text).toContain('const playLimitToast = usePlayLimitToast()');
    expect(toastHook).toContain('export const PLAY_LIMIT_TOAST_DISMISS_MS = 5000');
    expect(toastHook).toContain('window.setTimeout(dismiss, PLAY_LIMIT_TOAST_DISMISS_MS)');
    expect(text).toContain('physics-paint-canvas-toast');
    expect(text).toContain('Dismiss Play duration warning');
  });

  it('uses Play keyboard transport to render/apply stale Play scripts instead of only previewing live canvas', () => {
    const keyBlock = studioKeyboardSource();

    expect(keyBlock).toContain("workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')");
    expect(keyBlock).toContain("!state.savedPlayCacheDirty && actions.findCachedPlayFrames(state.framesToApply)");
    expect(keyBlock).toContain('actions.playPreview(state.framesToApply)');
    expect(keyBlock).toContain('else actions.savePlay()');
  });

  it('loads the first cached Play frame when opening a clean saved Play script', () => {
    const text = source();
    const coordinator = playCoordinatorSource();

    expect(coordinator).toContain('useEffect(() => {');
    expect(coordinator).toContain("if (input.workflowMode !== 'play') return");
    expect(coordinator).toContain('editCache.loadCachedPreviewFrame(editCache.localPreviewFrame)');
    expect(text).toContain('cachedPlayPreviewUrl,');
    expect(readFileSync(viewPath, 'utf8')).toContain('cachedPlayPreviewUrl={canvas.cachedPlayPreviewUrl}');
    expect(text).toContain('class="physics-paint-cached-play-preview"');
    expect(styles()).toContain('.physics-paint-cached-play-preview');
    expect(text).toContain('savedPlayCacheDirty');
  });

  it('delegates editable session persistence and debug proof export to the focused controller', () => {
    const text = source();
    const controller = sessionControllerSource();

    expect(text).toContain("import { usePhysicsPaintSessionController, type PhysicsPaintDebugProof } from './hooks/usePhysicsPaintSessionController'");
    expect(text).toContain('const sessionActions = usePhysicsPaintSessionController(input.session)');
    expect(controller).toContain('capturePendingPlayFrameEdits()');
    expect(controller).toContain('annotatePlayState(engine.save())');
    expect(controller).toContain('downloadPhysicsPaintState(editableState)');
    expect(controller).toContain("result.status === 'cancelled'");
    expect(controller).toContain('reader.onerror');
    expect(controller).toContain("inputElement.value = ''");
    expect(controller).toContain('resizePhysicsPaintState(');
    expect(controller).toContain('buildPhysicsPaintDebugProof');
  });

  it('rebuilds Play editing context while loading Roto state directly into the engine', () => {
    const controller = sessionControllerSource();

    expect(controller).toContain('const assignments = getPlayFrameEditAssignments(state)');
    expect(controller).toContain('restorePlayFrameEdits(assignments, previewFrame, state.strokes.length)');
    expect(playEditCacheControllerSource()).toContain('editBaselineRef.current = { frame, strokeCount }');
    expect(controller).toContain("playCacheStatus: 'stale'");
    expect(controller).toContain('cachedPlayFrames: []');
    expect(controller).toContain('clearLatestPlayFrames()');
    expect(controller).toContain('setSavedPlayCacheDirty(true)');
    expect(controller).toContain("if (input.workflowMode === 'play')");
    expect(controller).toContain('engine.load(state)');
  });

  it('uses the selected cached Play frame as the edit background without keeping the preview overlay alive', () => {
    const controller = playEditCacheControllerSource();

    expect(controller).toContain('type PreviewBackgroundEngine = EfxPaintEngine &');
    expect(controller).toContain('const cachedFrame = findCachedFrame(previewFrame)');
    expect(controller).toContain('previewEngine.clearPreviewBaseImage()');
    expect(controller).toContain('previewEngine.setBackgroundImageUrl(cachedFrame.dataUrl)');
    expect(controller).toContain('const cachedFrame = cacheDirty ? null : findCachedFrame(localPreviewFrame)');
    expect(controller).toContain('if (cachedPreviewUrl) setCachedPreviewUrl(null)');
    expect(controller).toContain('editBaselineRef.current = { frame: localPreviewFrame, strokeCount: input.engine.getStrokeCount() }');
    expect(controller).toContain('setCacheDirty(true)');
  });

  it('updates selected Play options without rendering and clears cached preview only when options changed', () => {
    const updateBlock = playCoordinatorSource().slice(playCoordinatorSource().indexOf('const updateSelectedOptions = useCallback'), playCoordinatorSource().indexOf('const savePlay = useCallback'));

    expect(readFileSync(fileURLToPath(new URL('./engine/physicsPaintStudioSettings.ts', import.meta.url)), 'utf8')).toContain('export function buildPlayRenderOptionsSnapshot');
    expect(bridgeSource()).toContain('playRenderOptions: structuredClone(containingRange.renderOptions)');
    expect(updateBlock).toContain("kind: 'update-play-render-options'");
    expect(updateBlock).toContain('buildPlayRenderOptionsSnapshot(input.settings, input.playWiggle)');
    expect(playLifecycleTransactionsSource()).toContain('JSON.stringify(input.context.playRenderOptions ?? null) !== JSON.stringify(input.renderOptions)');
    expect(updateBlock).toContain('editCache.setCachedPreviewUrl(null)');
    expect(updateBlock).toContain('editCache.setCacheDirty(true)');
    expect(updateBlock).not.toContain('playerRef.current?.play');
    expect(updateBlock).not.toContain('savePlay()');
  });

  it('previews dirty Play edits with selected-frame annotations before saving', () => {
    const previewBlock = playPreviewControllerSource();

    expect(previewBlock).toContain('input.capturePendingFrameEdits()');
    expect(previewBlock).toContain('const previewState = input.annotateState(input.engine.save())');
    expect(previewBlock).toContain('(input.engine as PreviewEngine).resetBackground()');
    expect(previewBlock).toContain('input.engine.load(previewState)');
    expect(previewBlock).toContain('playerRef.current.play');
  });

  it('keeps cached edit backgrounds and Roto repaint bases out of generated output', () => {
    const engine = engineSource();

    expect(engine).toContain('setBackgroundImageUrl(dataUrl: string)');
    const backgroundBlock = engine.slice(engine.indexOf('setBackgroundImageUrl(dataUrl: string)'), engine.indexOf('resetBackground(): void'));
    const previewBaseBlock = engine.slice(engine.indexOf('private redrawPreviewBase()'), engine.indexOf('private resetReplaySurface'));
    const exportBlock = engine.slice(engine.indexOf('exportCompositeCanvas(): HTMLCanvasElement'), engine.indexOf('// ================================================================', engine.indexOf('exportCompositeCanvas(): HTMLCanvasElement')));

    expect(engine).toContain('const requestId = ++this.previewBackgroundRequestId');
    expect(engine).toContain('if (requestId !== this.previewBackgroundRequestId || this.destroyed || this.animationMode || this.state.drawing) return');
    expect(backgroundBlock).not.toContain('this.redrawAll()');
    expect(engine).toContain('resetBackground(): void');
    expect(engine).toContain('this.previewBackgroundRequestId += 1');
    expect(engine).toContain('setPreviewBaseImageUrl(dataUrl: string)');
    expect(previewBaseBlock).toContain('this.dualCanvas.previewBaseCtx.drawImage(this.bgCanvas, 0, 0)');
    expect(previewBaseBlock).toContain('this.dualCanvas.previewBaseCtx.drawImage(this.previewBaseImage, 0, 0, this.width, this.height)');
    expect(exportBlock).not.toContain('previewBaseCanvas');
  });

  it('saves Play using selected script range and clears dirty cache status after regenerated frames publish', () => {
    const text = source();
    const coordinator = playCoordinatorSource();
    const savePlayBlock = coordinator.slice(coordinator.indexOf('const savePlay = useCallback'), coordinator.indexOf('return {', coordinator.indexOf('const savePlay = useCallback')));

    expect(savePlayBlock).toContain('const playStartFrame = getActivePlayStartFrame(input.launchContext, input.currentFrame)');
    expect(playPreviewControllerSource()).toContain('appFrame: options.startFrame + frameIndex');
    expect(savePlayBlock).toContain('startFrame: playStartFrame');
    expect(savePlayBlock).toContain('editCache.setLatestFrames(frames)');
    expect(savePlayBlock).toContain('editCache.setLatestFrames(frames)');
    expect(savePlayBlock).toContain('editCache.setCachedPreviewUrl(frames[0]?.dataUrl ?? null)');
    expect(savePlayBlock).toContain('editCache.setCacheDirty(false)');
    expect(savePlayBlock).toContain('editCache.setLocalPreviewFrame(0)');
    expect(savePlayBlock).toContain('playScriptId: input.launchContext.selectedPlayScriptId');
    expect(savePlayBlock).toContain('playMotion: input.playWiggle');
    expect(savePlayBlock).toContain('renderOptions,');
    expect(savePlayBlock).toContain('renderOptions,');
    expect(playLifecycleTransactionsSource()).toContain('playRenderOptions: input.renderOptions');
    expect(savePlayBlock).toContain('editCache.annotateState(input.engine.save())');
    expect(savePlayBlock).toContain('(input.engine as PreviewBackgroundEngine).resetBackground()');
    expect(savePlayBlock).not.toContain('strokeStyleOverride');
    expect(text).not.toContain('function buildPlayStrokeStyleOverride');
  });

  it('36.12 UAT Test 8 wires visible Roto interpolation count through store-owned regeneration and status copy', () => {
    const text = source();
    const workflowStripStart = text.indexOf('    workflow: {');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));
    const updateBlock = readFileSync(interpolationControllerPath, 'utf8');
    const cacheTransactions = rotoCacheTransactionsSource();

    expect(text).toContain('const updateRotoInterpolationSettings = useCallback');
    expect(updateBlock).toContain('input.updateSettings(input.currentFrame, patch)');
    expect(updateBlock).not.toContain('mode: patch.mode ?? currentSettings.mode');
    expect(updateBlock).toContain('input.updateSettings(input.currentFrame, patch)');
    expect(updateBlock).toContain("kind: 'update-roto-interpolation-settings'");
    expect(updateBlock).toContain('settings: transaction.settings');
    expect(updateBlock).toContain('await input.sendApplyPayload(payload, input.bridgeMode)');
    const launchHydration = rotoLaunchHydrationSource();
    expect(text).not.toContain('function hydrateLaunchContextRotoInterpolation');
    expect(text).toContain('const hydratedContext = hydrateRotoLaunchContext(incomingContext, physicPaintStore)');
    expect(launchHydration).toContain('export function seedRotoLaunchRealKeys');
    expect(launchHydration).toContain('const sourceFrame = frame.sourceFrame ?? frame.appFrame;');
    expect(launchHydration).toContain('store.upsertRealRotoKeyFrame(context.layerId, sourceFrame, frame, frame.backgroundOnly === true)');
    expect(updateBlock).toContain('seedRotoLaunchRealKeys(launchContext, input.seedStore)');
    expect(updateBlock).toContain('const cacheRefresh = refreshRotoInterpolationCache(');
    expect(updateBlock).toContain('transaction.settings.enabled');
    expect(cacheTransactions).toContain('mergeRotoCacheFramesPreservingLaunchRealKeys(launchFrames, storeFrames)');
    expect(cacheTransactions).toContain('.map(normalizeCachedRotoRealKeySourceFrame)');
    expect(cacheTransactions).toContain('const frames = storeFrames.length > 0');
    expect(cacheTransactions).toContain("storeFrames.filter((frame) => enabled || frame.source === 'real-key')");
    expect(cacheTransactions).toContain('realDisplayFrames: realKeys.map((frame) => frame.displayFrame ?? frame.appFrame)');
    expect(updateBlock).toContain('input.setEditableFrames((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)))');
    expect(updateBlock).not.toContain('setOccupiedRotoFrames');
    expect(updateBlock).not.toContain('setSavedRotoFrames');
    expect(updateBlock).toContain('startFrame: transaction.nextCurrentFrame');
    expect(updateBlock).not.toContain('physicPaintStore.regenerateRotoInterpolationCache(launchContext.layerId)');
    expect(text).toContain('getFailureStatus: () => launchContext ? physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId) : null');
    expect(updateBlock).not.toContain('Generated in-betweens could not regenerate. Real keys were kept.');
    expect(updateBlock).not.toContain('Generated in-betweens on — render-only frames refresh from real keys.');
    expect(updateBlock).not.toContain('Generated in-betweens on — save at least two real Roto keys.');
    expect(updateBlock).not.toContain('Generated in-betweens off — real Roto keys only.');
    expect(updateBlock).toContain('setLaunchContext((current) => current ? {');
    expect(updateBlock).toContain('cachedRotoFrames: cacheRefresh.frames');
    expect(updateBlock).toContain('rotoInterpolationSettings: transaction.settings');
    const resultStart = text.indexOf('const handleApplyResult = useCallback');
    const resultBlock = text.slice(resultStart, text.indexOf('usePhysicsPaintApplyResultBridge', resultStart));
    expect(resultBlock).not.toContain('handleRotoApplyResult');
    expect(resultBlock).toContain("detail.kind === 'update-roto-interpolation-settings'");
    expect(resultBlock).toContain("setApplyMessage((message) => message || 'Generated in-between settings synced.')");
    expect(text).toContain('rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId)');
    expect(workflowStripBlock).toContain('onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled })');
    expect(workflowStripBlock).toContain('onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })');
    expect(workflowStripBlock).not.toContain('onRotoInterpolationModeChange=');
    expect(workflowStripBlock).not.toContain('onRotoInterpolationMotionChange=');
  });

  it('delegates cached Roto playback state and timer ownership to the focused hook', () => {
    const text = source();
    const cachedRotoBlock = rotoNavigationCoordinatorSource();
    const canvasStackBlock = text.slice(text.indexOf('    canvas: {'), text.indexOf('    rightPanel: {'));
    const workflowStripStart = text.indexOf('    workflow: {');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(rotoNavigationCoordinatorSource()).toContain("from './useRotoCachedPlayback'");
    expect(rotoNavigationCoordinatorSource()).toContain('const playback = useRotoCachedPlayback({');
    expect(text).toContain('resetRotoNavigationForLaunchRef.current = rotoNavigation.resetForLaunch');
    expect(text).not.toContain('rotoCachedPlaybackTimerRef');
    expect(text).not.toContain('const startRotoCachedPlayback = useCallback');
    expect(text).not.toContain('const stopRotoCachedPlayback = useCallback');
    const referenceController = rotoReferenceControllerSource();
    expect(text).toContain('const reference = useRotoReferenceController<RenderedFramePayload>({');
    expect(referenceController).toContain('export function findCachedRotoDisplayFrame');
    expect(referenceController).toContain('export function findCachedRotoReferenceFrame');
    expect(referenceController).toContain("frame.source === 'generated-interpolation'");
    expect(referenceController).toContain('input.previewFrames.get(appFrame)');
    expect(referenceController).toContain('input.confirmedFrames.values()');
    expect(cachedRotoBlock).toContain('RotoCachedPlaybackFrame<TPreview>');
    expect(cachedRotoBlock).toContain('keyUtilities.session.playbackFrameNumbers.value.map');
    expect(cachedRotoBlock).not.toContain('return getRealCachedRotoDisplayFrameNumbers(launchContext)');
    expect(text).toContain('onFrame: (frameIndex) => {');
    expect(text).not.toContain('setLaunchContext((current) => current ? { ...current, startFrame: appFrame } : current)');
    expect(canvasStackBlock).toContain('cachedRotoPlaybackUrl: rotoCachedPlayback.frame?.dataUrl ?? null');
    expect(canvasStackBlock).toContain('cachedRotoPlaybackActive: rotoCachedPlayback.isActive');
    const view = readFileSync(viewPath, 'utf8');
    expect(view).toContain("physics-paint-canvas-stack${props.cachedRotoPlaybackActive ? ' cached-roto-playback-active' : ''}");
    expect(view).toContain('!props.cachedRotoPlaybackActive && props.cachedRotoReferenceUrl');
    expect(view).toContain('class="physics-paint-cached-roto-playback" src={props.cachedRotoPlaybackUrl}');
    expect(view).toContain('class="physics-paint-cached-roto-playback-background"');
    expect(view).not.toContain('const paint = new Image()');
    expect(view).not.toContain('drawRotoFrameComposite(context');
    expect(view).not.toContain('drawMissingRotoBackground');
    expect(view).not.toContain('paper.src = `/img/paper_');
    expect(view).toContain('subscribeProjectPaperCanvas(props.background.background, props.width, props.height');
    expect(view).toContain("[props.background.background, props.background.color, props.background.grainStrength, props.background.paperGrain, props.height, props.width]");
    const css = styles();
    expect(css).toContain('.physics-paint-canvas-stack.cached-roto-playback-active > .demo-canvas-shell .paint-canvas > canvas');
    expect(css).toContain('visibility: hidden');
    expect(css).not.toContain('.physics-paint-canvas-stack.cached-roto-playback-active > .demo-canvas-shell {\n  visibility: hidden;');
    expect(css).toContain('.paint-canvas {');
    expect(css).not.toContain("background-image: url('/img/paper_1.jpg');");
    expect(css).not.toContain("background: url('/img/paper_1.jpg') center / cover, #fff;");
    expect(canvasMountSource()).toContain("'--physics-paint-paper-texture-scale': props.paperTextureScale");
    expect(css).toContain('.physics-paint-cached-roto-playback {');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackAvailable');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackStatus: rotoCachedPlayback.status');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackLoop: rotoCachedPlayback.loop');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackFps: rotoCachedPlayback.fps');
    expect(workflowStripBlock).toContain('isRotoCachedPlaybackActive: rotoCachedPlayback.isActive');
    expect(workflowStripBlock).toContain('onToggleRotoPlayback: rotoCachedPlayback.toggle');
    expect(workflowStripBlock).toContain('onRotoPlaybackLoopChange: rotoCachedPlayback.setLoop');
    expect(workflowStripBlock).toContain('onRotoPlaybackFpsChange: rotoCachedPlayback.updateFps');
  });

  it('stops cached Roto playback through the hook for edit intent, navigation, and preview cleanup', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const requestNavigationBlock = rotoNavigationCoordinatorSource();
    const canvasStackBlock = text.slice(text.indexOf('    canvas: {'), text.indexOf('    rightPanel: {'));

    expect(readFileSync(studioSelectorsPath, 'utf8')).toContain("input.applyStatus === 'applying' || (input.isPlaying && !input.rotoPlaybackActive)");
    expect(navigateBlock).toContain('rotoCachedPlayback.stop()');
    expect(requestNavigationBlock).toContain('return runtimePortRef.current.navigateToSyncedFrame(targetFrame)');
    expect(requestNavigationBlock).not.toContain('saveFrame');
    expect(text).toContain('const beginRotoFrameEdit = useCallback');
    expect(studioKeyboardSource()).toContain("if (event.key === ' ')");
    expect(studioKeyboardSource()).toContain('actions.toggleRotoPlayback()');
    expect(canvasStackBlock).toContain('onInputIntent: workflowMode === \'play\' ? beginPlayFrameEdit : beginRotoFrameEdit');
    expect(text).toContain('rotoCachedPlayback.stop();');
  });
});

describe('PhysicsPaintStudio automatic Roto pixel cache contract', () => {
  it('wires completed engine mutations directly to pixel cache capture for editable real keys', () => {
    const text = studioPresentationSource();
    const canvasBlock = canvasMountSource();

    expect(canvasBlock).toContain('onCompletedMutation');
    expect(text).toContain("workflowMode !== 'roto'");
    expect(text).toContain("currentFrameSelectionKind === 'generated-interpolation'");
    expect(text).toContain('mutationEngine.copyLiveAlphaCanvas()');
    expect(text).toContain('rotoPersistence.captureLivePixels({');
    expect(text).toContain('cachedBase');
    expect(text).not.toContain('onSaveRotoFrame');
    expect(text).not.toContain('onSavePendingRotoFrames');
  });

  it('removes save-on-leave, close-save, pending, retry, and manual-save controllers', () => {
    const text = studioPresentationSource();
    const navigation = rotoNavigationCoordinatorSource();

    for (const obsolete of [
      'saveOnLeave',
      'Save current',
      'Save pending',
      'rotoSavingFrame',
      'pendingRotoAdvance',
      'closeAfterRotoSave',
      'useRotoSaveController',
      'useRotoCloseLifecycle',
      'useRotoApplyResultController',
    ]) expect(text).not.toContain(obsolete);
    expect(navigation).toContain('return runtimePortRef.current.navigateToSyncedFrame(targetFrame)');
  });

  it('keeps Roto input disabled only for generated interpolation displays', () => {
    const text = studioPresentationSource();
    expect(text).toContain('const rotoInputDisabled = currentFrameIsGeneratedRoto');
    expect(text).not.toContain("currentFrameSelectionKind !== 'real-key'");
    expect(text).not.toContain("rotoInputDisabled = workflowMode === 'roto' && applyStatus === 'applying'");
  });

  it('keeps Play save behavior while Roto keyboard handling has no manual save route', () => {
    const keyboard = readFileSync(studioKeyboardPath, 'utf8');
    expect(keyboard).toContain("state.workflowMode === 'play'");
    expect(keyboard).toContain('actions.savePlay()');
    expect(keyboard).not.toContain('onSaveRoto');
    expect(keyboard).not.toContain('saveRoto');
  });
});
