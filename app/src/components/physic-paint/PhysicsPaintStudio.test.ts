import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const topBarPath = fileURLToPath(new URL('./PhysicsPaintTopBar.tsx', import.meta.url));
const stylePath = fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url));
const defaultCapabilityPath = fileURLToPath(new URL('../../../src-tauri/capabilities/default.json', import.meta.url));
const bridgePath = fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url));
const enginePath = fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');
const topBarSource = () => readFileSync(topBarPath, 'utf8');
const styles = () => readFileSync(stylePath, 'utf8');
const bridgeSource = () => readFileSync(bridgePath, 'utf8');
const engineSource = () => readFileSync(enginePath, 'utf8');

describe('PhysicsPaintStudio onion preview contract', () => {
  it('captures transparent stroke previews instead of full paper composite snapshots', () => {
    const text = source();

    expect(text).toContain('function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement');
    expect(text).toContain("engine.setBgMode('transparent')");
    expect(text).toContain('return engine.exportCompositeCanvas()');
    expect(text).toContain('engine.load(state)');
    expect(text).toContain('function drawCanvasAtSize(canvas: HTMLCanvasElement, size: { width: number; height: number }): HTMLCanvasElement');
    expect(text).toContain('context?.drawImage(canvas, 0, 0, size.width, size.height)');
    expect(text).toContain('function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(engine.exportCompositeCanvas(), appFrame, { width, height })');
    expect(text).toContain('function buildRotoOnionPreviewFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width, height })');
  });

  it('clips the onion overlay to measured canvas bounds, not the full canvas stack', () => {
    const text = source();

    expect(text).toContain('function PhysicsPaintCanvasStack');
    expect(text).toContain('const canvasRect = canvas.getBoundingClientRect()');
    expect(text).toContain('left: canvasRect.left - stackRect.left');
    expect(text).toContain('width: canvasRect.width');
    expect(text).toContain('class="physics-paint-onion-overlay canvas-region"');
    expect(text).toContain('style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}');
    expect(text).not.toContain('<div class="physics-paint-onion-overlay canvas-region" aria-hidden="true">');
  });

  it('keeps reference overlays below the live paint cursor and stroke preview', () => {
    const css = styles();

    expect(css).toContain('.physics-paint-onion-overlay.canvas-region {\n  inset: auto;\n  z-index: 3;');
    expect(css).toContain('.demo-canvas-shell .paint-canvas canvas + canvas {\n  z-index: 4 !important;');
    expect(css).toContain('mix-blend-mode: multiply');
    expect(css).not.toContain('mix-blend-mode: screen');
  });

  it('sends paper composite frames to EFX Motion while caching transparent onion previews', () => {
    const text = source();
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));

    expect(flushBlock).toContain('const renderedFrame = buildRotoOutputFrame(engine, frame, canvasWidth, canvasHeight)');
    expect(flushBlock).toContain('rotoPreviewFramesRef.current.set(frame, backgroundOnly ? renderedFrame : buildRotoOnionPreviewFrame(engine, frame, canvasWidth, canvasHeight))');
    expect(flushBlock).toContain('renderedFrame,');
  });

  it('persists Roto background metadata from standalone paper settings without creating cached cells', () => {
    const text = source();

    expect(text).toContain('function buildRotoBackgroundMetadata(settings: PhysicsPaintStudioSettings): PhysicPaintRotoBackgroundMetadata');
    expect(text).toContain('physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings))');
    expect(text).toContain('persistRotoBackgroundMetadata();');
    expect(text).not.toContain('setFrame(launchContext.layerId, currentFrame, buildRotoBackgroundMetadata');
  });

  it('applies onion previous/next toggles and opacity to the canvas overlay', () => {
    const text = source();

    expect(text).toContain('opacity: 60');
    expect(text).toContain('const onionOpacity = clampOnionOpacity(onion.opacity) / 100');
    expect(text).toContain("frame.direction === 'previous' && onion.previous");
    expect(text).toContain("frame.direction === 'next' && onion.next");
    expect(text).toContain('Math.max(0.08, onionOpacity - frame.distance * 0.08)');
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
  it('initializes saved and occupied Roto cells from real cached launch frames after reopen', () => {
    const text = source();

    expect(text).toContain('function getRealCachedRotoFrames(context: PhysicPaintLaunchContext | null)');
    expect(text).toContain('function getSavedRotoMarkersFromLaunchContext(context: PhysicPaintLaunchContext | null)');
    expect(text).toContain('useState<PhysicsPaintWorkflowStripFrameMarker[]>(() => getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).toContain('useState<number[]>(() => getRealCachedRotoFrameNumbers(launchContext))');
    expect(text).toContain('useState<number[]>([])');
    expect(text).toContain('setSavedRotoFrames(getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).toContain('setOccupiedRotoFrames(getRealCachedRotoFrameNumbers(launchContext))');
    expect(text).toContain('cachedRotoFrames={launchContext?.cachedRotoFrames}');
  });

  it('synthesizes transient background-only Roto playback frames without cached cell mutation', () => {
    const text = source();
    const playbackBlock = text.slice(text.indexOf('function buildTransientRotoBackgroundFrame'), text.indexOf('useEffect(() => {', text.indexOf('function buildTransientRotoBackgroundFrame')));

    expect(playbackBlock).toContain('physicPaintStore.getRotoBackgroundMetadata(launchContext.layerId)');
    expect(playbackBlock).toContain("if (!metadata || metadata.background === 'transparent') return null");
    expect(playbackBlock).toContain('data:application/x-efx-roto-background');
    expect(playbackBlock).toContain('return findCachedRotoReferenceFrame(appFrame) ?? buildTransientRotoBackgroundFrame(appFrame)');
    expect(playbackBlock).not.toContain('physicPaintStore.setFrame');
    expect(playbackBlock).not.toContain('setSavedRotoFrames');
  });

  it('shows cached Roto references as an overlay without installing them as the engine paper background', () => {
    const text = source();
    const loadBlock = text.slice(text.indexOf('function loadCachedRotoReferenceFrame'), text.indexOf('useEffect(() => {', text.indexOf('function loadCachedRotoReferenceFrame')));

    expect(loadBlock).toContain('setCachedRotoReferenceUrl(cachedFrame?.dataUrl ?? null)');
    expect(loadBlock).toContain('targetEngine.resetBackground()');
    expect(loadBlock).toContain('targetEngine.clear()');
    expect(loadBlock).not.toContain('targetEngine.setBackgroundImageUrl(cachedFrame.dataUrl)');
    expect(text).toContain('const resetRotoSessionForLaunch = useCallback');
    expect(text).toContain('resetRotoSessionForLaunch(context, { preserveCloseAfterRotoSave })');
    expect(text).toContain('loadCachedRotoReferenceFrame(context.startFrame, readyEngine as PreviewBackgroundEngine, context)');
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

  it('fetches the stored Tauri launch context after mount so editable Play state and cached frames are not lost on reopen', () => {
    const text = source();

    expect(text).toContain("coreApi.invoke('get_physics_paint_launch_context')");
    expect(text).toContain('isPhysicPaintLaunchContext(storedContext)');
    expect(text).toContain('const applyIncomingLaunchContext = useCallback');
    expect(text).toContain('applyIncomingLaunchContext(storedContext)');
    expect(text).toContain('applyIncomingLaunchContext(event.payload)');
    expect(text).toContain('setSavedPlayCacheDirty?.(getLaunchWorkflowMode(context) === \'play\' && context.playCacheStatus !== \'cached\')');
  });

  it('accepts saved Play source metadata through the parsed launch context path', () => {
    const text = source();

    expect(text).toContain('workflowMode: workflowMode === \'play\' ? \'play\' : \'roto\'');
    expect(text).toContain('playStartFrame: Number.isInteger(playStartFrame) && playStartFrame >= 0 ? playStartFrame : undefined');
    expect(text).toContain('playFrameCount: Number.isInteger(playFrameCount) && playFrameCount > 0 ? playFrameCount : undefined');
    expect(text).toContain('editableSource: editableSource === \'play\' ? \'play\' : editableSource === \'roto\' ? \'roto\' : undefined');
    expect(text).toContain('const parsed = JSON.parse(encodedContext)');
    expect(text).not.toContain('JSON.parse(decodeURIComponent(encodedContext))');
  });

  it('keeps Play frame conversion availability separate from cleared onion preview state', () => {
    const text = source();

    expect(text).toContain('const [playFramesVersion, setPlayFramesVersion] = useState(0)');
    expect(text).toContain('latestPlayFramesRef.current = frames');
    expect(text).toContain('setLatestPlayFrames(frames)');
    expect(text).toContain('setPlayFramesVersion((version) => version + 1)');
    expect(text).toContain('new Set(latestPlayFramesRef.current.map((frame) => frame.appFrame))');
    expect(text).toContain('playFramesVersion');
  });
});

describe('PhysicsPaintStudio local Play preview contract', () => {
  it('initializes local preview frame from saved Play launch context', () => {
    const text = source();

    expect(text).toContain('const [localPlayPreviewFrame, setLocalPlayPreviewFrame]');
    expect(text).toContain('const previewFrame = context?.previewFrame');
    expect(text).toContain('setLocalPlayPreviewFrame?.(getLaunchPreviewFrame(context))');
    expect(text).toContain('currentPreviewFrame={localPlayPreviewFrame}');
  });

  it('keeps local Play scrub separate from editor frame sync', () => {
    const text = source();
    const localPreviewBlock = text.slice(text.indexOf('const previewLocalPlayFrame = useCallback'), text.indexOf('const handleApplyResult = useCallback'));

    expect(localPreviewBlock).toContain('setLocalPlayPreviewFrame');
    expect(localPreviewBlock).toContain('loadCachedPlayPreviewFrame');
    expect(localPreviewBlock).not.toContain('sendPhysicPaintFrameSyncMessage');
    expect(text).toContain('onPreviewPlayFrame={previewLocalPlayFrame}');
    expect(text).not.toContain('onInspectPlayFrame={navigateToSyncedFrame}');
  });

  it('uses cached saved Play frames while clean and switches to live preview after clear/remake', () => {
    const text = source();

    expect(text).toContain('const [savedPlayCacheDirty, setSavedPlayCacheDirty]');
    expect(text).toContain('function loadCachedPlayPreviewFrame');
    expect(text).toContain('function getCachedPlayFramesForRange');
    expect(text).toContain('const cachedPreviewTimerRef = useRef<number | null>(null)');
    expect(text).toContain('Previewing cached ${safeFrameCount} frames at ${previewFps} fps.');
    expect(text).toContain('latestPlayFramesRef.current.find((frame) => frame.appFrame === appFrame)');
    expect(text).toContain('launchContext.cachedPlayFrames?.find((frame) => frame.appFrame === appFrame)');
    expect(text).toContain('physicPaintStore.getFrame(launchContext.layerId, appFrame)');
    expect(text).toContain('setCachedPlayPreviewUrl(cachedFrame?.dataUrl ?? null)');
    expect(text).toContain('if (savedPlayCacheDirty)');
    expect(text).toContain('setCachedPlayPreviewUrl(null)');
    expect(text).toContain('setSavedPlayCacheDirty(true)');
    expect(text).toContain('markSelectedPlayCacheDirty');
  });

  it('passes launch gap limits into the fixed Play mode so frame 11 can clamp to one visible cell', () => {
    const text = source();
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));

    expect(text).toContain('function withoutRotoGapLimit');
    expect(text).toContain("if (context.workflowMode === 'play') return context;");
    expect(text).toContain('delete next.maxPlayFrameCount');
    expect(text).toContain('...withoutRotoGapLimit(current)');
    expect(workflowStripBlock).toContain('maxPlayFrameCount={launchContext?.maxPlayFrameCount}');
    expect(workflowStripBlock).toContain('maxPlayFrameCountReason={launchContext?.maxPlayFrameCountReason}');
    expect(workflowStripBlock).toContain('onPlayLimit={showPlayLimitToast}');
    expect(workflowStripBlock).toContain('startFrame={launchContext?.startFrame ?? 0}');
    expect(workflowStripBlock).not.toContain("maxPlayFrameCount={workflowMode === 'play' ? undefined");
  });

  it('surfaces Play duration bound warnings as a dismissible top-canvas toast', () => {
    const text = source();

    expect(text).toContain('const [playLimitToast, setPlayLimitToast]');
    expect(text).toContain('const showPlayLimitToast = useCallback');
    expect(text).toContain('PLAY_LIMIT_TOAST_DISMISS_MS');
    expect(text).toContain('physics-paint-canvas-toast');
    expect(text).toContain('Dismiss Play duration warning');
  });

  it('uses Play keyboard transport to render/apply stale Play scripts instead of only previewing live canvas', () => {
    const text = source();
    const keyBlock = text.slice(text.indexOf('const handlePhysicsPaintKeyDown = useCallback'), text.indexOf('const onionPreviewFrames'));

    expect(keyBlock).toContain("workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')");
    expect(keyBlock).toContain("!savedPlayCacheDirty && getCachedPlayFramesForRange(framesToApply)");
    expect(keyBlock).toContain('playPreview(framesToApply)');
    expect(keyBlock).toContain('else void savePlay()');
  });

  it('loads the first cached Play frame when opening a clean saved Play script', () => {
    const text = source();

    expect(text).toContain('useEffect(() => {');
    expect(text).toContain("if (workflowMode !== 'play') return");
    expect(text).toContain('loadCachedPlayPreviewFrame(localPlayPreviewFrame)');
    expect(text).toContain('cachedPlayPreviewUrl={cachedPlayPreviewUrl}');
    expect(text).toContain('class="physics-paint-cached-play-preview"');
    expect(styles()).toContain('.physics-paint-cached-play-preview');
    expect(text).toContain('savedPlayCacheDirty');
  });

  it('allows Play canvas drawing on selected frames and marks cached scripts stale', () => {
    const text = source();
    const saveEditableStateBlock = text.slice(text.indexOf('const saveEditableState = useCallback'), text.indexOf('const loadEditableState = useCallback'));

    expect(text).toContain('function annotatePlayFrameStrokes');
    expect(text).toContain('const playFrameEditAssignmentsRef = useRef<Map<number, number>>(new Map())');
    expect(text).toContain('const beginPlayFrameEdit = useCallback');
    expect(text).toContain('playFrameEditBaselineRef.current = { frame: localPlayPreviewFrame, strokeCount }');
    expect(text).toContain('engine.getStrokeCount()');
    expect(text).not.toContain('engine.save().strokes.length');
    expect(text).toContain('setSavedPlayCacheDirty(true)');
    expect(text).toContain("onInputIntent={workflowMode === 'play' ? beginPlayFrameEdit : beginRotoFrameEdit}");
    expect(text).not.toContain('inputDisabled={!canEditCurrentPlayFrame}');
    expect(saveEditableStateBlock).toContain('capturePendingPlayFrameEdits()');
    expect(saveEditableStateBlock).toContain('annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current)');
    expect(saveEditableStateBlock).toContain('downloadPhysicsPaintState(editableState)');
  });

  it('rebuilds Play editing context when loading a saved editable state', () => {
    const text = source();
    const loadEditableStateBlock = text.slice(text.indexOf('const loadEditableState = useCallback'), text.indexOf('const exportDebugProof = useCallback'));

    expect(text).toContain('function getPlayFrameEditAssignments');
    expect(text).toContain('function getPlayFrameCountFromAssignments');
    expect(loadEditableStateBlock).toContain('const assignments = getPlayFrameEditAssignments(state)');
    expect(loadEditableStateBlock).toContain('playFrameEditAssignmentsRef.current = assignments');
    expect(loadEditableStateBlock).toContain('playFrameEditBaselineRef.current = { frame: previewFrame, strokeCount: state.strokes.length }');
    expect(loadEditableStateBlock).toContain("playCacheStatus: 'stale'");
    expect(loadEditableStateBlock).toContain('cachedPlayFrames: []');
    expect(loadEditableStateBlock).toContain('setSavedPlayCacheDirty(true)');
  });

  it('uses the selected cached Play frame as the edit background without keeping the preview overlay alive', () => {
    const text = source();
    const loadBlock = text.slice(text.indexOf('function loadCachedPlayPreviewFrame'), text.indexOf('function getCachedPlayFramesForRange'));
    const editBlock = text.slice(text.indexOf('const beginPlayFrameEdit = useCallback'), text.indexOf('const showPlayLimitToast'));

    expect(text).toContain('type PreviewBackgroundEngine = EfxPaintEngine &');
    expect(loadBlock).toContain('findCachedPlayPreviewFrame(previewFrame)');
    expect(loadBlock).toContain('(engine as PreviewBackgroundEngine).setBackgroundImageUrl(cachedFrame.dataUrl)');
    expect(editBlock).toContain('const cachedFrame = savedPlayCacheDirty ? null : findCachedPlayPreviewFrame(localPlayPreviewFrame)');
    expect(editBlock).toContain('(engine as PreviewBackgroundEngine).setBackgroundImageUrl(cachedFrame.dataUrl)');
    expect(editBlock).toContain('if (cachedPlayPreviewUrl) setCachedPlayPreviewUrl(null)');
    expect(editBlock).toContain('playFrameEditBaselineRef.current = { frame: localPlayPreviewFrame, strokeCount }');
    expect(editBlock).toContain('setSavedPlayCacheDirty(true)');
  });

  it('updates selected Play options without rendering and clears cached preview only when options changed', () => {
    const text = source();
    const updateBlock = text.slice(text.indexOf('const updateSelectedPlayOptions = useCallback'), text.indexOf('const savePlay = useCallback'));

    expect(text).toContain('function buildPlayRenderOptionsSnapshot');
    expect(bridgeSource()).toContain('playRenderOptions: structuredClone(containingRange.renderOptions)');
    expect(updateBlock).toContain("kind: 'update-play-render-options'");
    expect(updateBlock).toContain('buildPlayRenderOptionsSnapshot(settings, playWiggle)');
    expect(updateBlock).toContain('JSON.stringify(launchContext.playRenderOptions ?? null) !== JSON.stringify(renderOptions)');
    expect(updateBlock).toContain('setCachedPlayPreviewUrl(null)');
    expect(updateBlock).toContain('setSavedPlayCacheDirty(true)');
    expect(updateBlock).not.toContain('playerRef.current?.play');
    expect(updateBlock).not.toContain('savePlay()');
  });

  it('previews dirty Play edits with selected-frame annotations before saving', () => {
    const text = source();
    const previewBlock = text.slice(text.indexOf('const playPreview = useCallback'), text.indexOf('const stopPreview = useCallback'));

    expect(previewBlock).toContain('capturePendingPlayFrameEdits()');
    expect(previewBlock).toContain('const previewState = annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current)');
    expect(previewBlock).toContain('(engine as PreviewBackgroundEngine).resetBackground()');
    expect(previewBlock).toContain('engine.load(previewState)');
    expect(previewBlock).toContain('playerRef.current.play');
  });

  it('keeps the cached edit background out of generated Play frames', () => {
    const engine = engineSource();

    expect(engine).toContain('setBackgroundImageUrl(dataUrl: string)');
    const backgroundBlock = engine.slice(engine.indexOf('setBackgroundImageUrl(dataUrl: string)'), engine.indexOf('resetBackground(): void'));

    expect(engine).toContain('const requestId = ++this.previewBackgroundRequestId');
    expect(engine).toContain('if (requestId !== this.previewBackgroundRequestId || this.destroyed || this.animationMode || this.state.drawing) return');
    expect(backgroundBlock).not.toContain('this.redrawAll()');
    expect(engine).toContain('resetBackground(): void');
    expect(engine).toContain('this.previewBackgroundRequestId += 1');
  });

  it('saves Play using selected script range and clears dirty cache status after regenerated frames publish', () => {
    const text = source();
    const savePlayBlock = text.slice(text.indexOf('const savePlay = useCallback'), text.indexOf('const savePendingRotoFrames'));

    expect(savePlayBlock).toContain('const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame)');
    expect(savePlayBlock).toContain('appFrame: playStartFrame + frameIndex');
    expect(savePlayBlock).toContain('startFrame: playStartFrame');
    expect(savePlayBlock).toContain('latestPlayFramesRef.current = frames');
    expect(savePlayBlock).toContain('setLatestPlayFrames(frames)');
    expect(savePlayBlock).toContain('setCachedPlayPreviewUrl(frames[0]?.dataUrl ?? null)');
    expect(savePlayBlock).toContain('setSavedPlayCacheDirty(false)');
    expect(savePlayBlock).toContain('setLocalPlayPreviewFrame(0)');
    expect(savePlayBlock).toContain('playScriptId: launchContext.selectedPlayScriptId');
    expect(savePlayBlock).toContain('playMotion: playWiggle');
    expect(savePlayBlock).toContain('renderOptions,');
    expect(savePlayBlock).toContain('playRenderOptions: renderOptions');
    expect(savePlayBlock).toContain('annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current)');
    expect(savePlayBlock).toContain('(engine as PreviewBackgroundEngine).resetBackground()');
    expect(savePlayBlock).not.toContain('strokeStyleOverride');
    expect(text).not.toContain('function buildPlayStrokeStyleOverride');
  });

  it('wires visible Roto interpolation settings through the store regeneration path', () => {
    const text = source();
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));
    const updateBlock = text.slice(text.indexOf('const updateRotoInterpolationSettings = useCallback'), text.indexOf('const goToFirstFrame = useCallback'));

    expect(text).toContain('const updateRotoInterpolationSettings = useCallback');
    expect(updateBlock).toContain('physicPaintStore.setRotoInterpolationSettings(launchContext.layerId');
    expect(updateBlock).toContain('physicPaintStore.regenerateRotoInterpolationCache(launchContext.layerId)');
    expect(updateBlock).toContain('setLaunchContext((current) => current ? {');
    expect(updateBlock).toContain('cachedRotoFrames: physicPaintStore.getRotoCacheFrames(launchContext.layerId)');
    expect(updateBlock).toContain('rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId)');
    expect(workflowStripBlock).toContain('onRotoInterpolationEnabledChange={(enabled) => updateRotoInterpolationSettings({ enabled })}');
    expect(workflowStripBlock).toContain('onRotoInterpolationCountChange={(inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })}');
    expect(workflowStripBlock).toContain('onRotoInterpolationModeChange={(mode) => updateRotoInterpolationSettings({ mode })}');
    expect(workflowStripBlock).toContain('onRotoInterpolationMotionChange={updateRotoInterpolationSettings}');
  });

  it('previews cached Roto playback from cached frames only and avoids AnimationPlayer in the Roto branch', () => {
    const text = source();
    const cachedRotoBlock = text.slice(text.indexOf('function findCachedRotoReferenceFrame'), text.indexOf('const playPreview = useCallback'));
    const toggleBlock = text.slice(text.indexOf('const toggleRotoCachedPlayback = useCallback'), text.indexOf('const stopPreview = useCallback'));
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));

    expect(text).toContain('const [isRotoCachedPlaybackActive, setIsRotoCachedPlaybackActive]');
    expect(text).toContain('const [cachedRotoPlaybackFrame, setCachedRotoPlaybackFrame]');
    expect(text).toContain('const rotoCachedPlaybackTimerRef = useRef<number | null>(null)');
    expect(cachedRotoBlock).toContain('function findCachedRotoReferenceFrame(appFrame: number, context: PhysicPaintLaunchContext | null = launchContext): RenderedFramePayload | null');
    expect(cachedRotoBlock).toContain('physicPaintStore.getFrame(context.layerId, appFrame)');
    expect(cachedRotoBlock).toContain('rotoPreviewFramesRef.current.get(appFrame)');
    expect(cachedRotoBlock).toContain('function findCachedRotoPlaybackFrame(appFrame: number): RenderedFramePayload | null');
    expect(cachedRotoBlock).toContain('return findCachedRotoReferenceFrame(appFrame)');
    expect(toggleBlock).toContain('const cachedFrames = getRotoCachedPlaybackFrames()');
    expect(toggleBlock).toContain('const missingCount = cachedFrames.filter((frame) => !frame).length');
    expect(toggleBlock).toContain('setCachedRotoPlaybackFrame(cachedFrame ?? null)');
    expect(toggleBlock).toContain('Missing frames play transparent/background');
    expect(toggleBlock).not.toContain('AnimationPlayer');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackAvailable={rotoCachedPlaybackAvailable}');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackStatus={rotoCachedPlaybackStatus}');
    expect(workflowStripBlock).toContain('isRotoCachedPlaybackActive={isRotoCachedPlaybackActive}');
    expect(workflowStripBlock).toContain('onToggleRotoPlayback={toggleRotoCachedPlayback}');
  });

  it('stops cached Roto playback on edit intent and manual Roto navigation', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const canvasStackBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('<CanvasMountProbe'));

    expect(text).toContain('const stopRotoCachedPlayback = useCallback');
    expect(navigateBlock).toContain('stopRotoCachedPlayback()');
    expect(navigateBlock).toContain('setCachedRotoPlaybackFrame(null)');
    expect(text).toContain('const beginRotoFrameEdit = useCallback');
    expect(canvasStackBlock).toContain('onInputIntent={workflowMode === \'play\' ? beginPlayFrameEdit : beginRotoFrameEdit}');
    expect(text).toContain("if (workflowMode !== 'roto') stopRotoCachedPlayback()");
  });
});

describe('PhysicsPaintStudio Roto cache-first autosave contract', () => {
  it('loads cached-only Roto frames as repaintable non-exported references', () => {
    const text = source();
    const loadBlock = text.slice(text.indexOf('function findCachedRotoReferenceFrame'), text.indexOf('const previewLocalPlayFrame = useCallback'));

    expect(text).toContain('const [cachedRotoReferenceUrl, setCachedRotoReferenceUrl] = useState<string | null>(null)');
    expect(text).toContain('function findCachedRotoReferenceFrame(appFrame: number, context: PhysicPaintLaunchContext | null = launchContext)');
    expect(loadBlock).toContain("context.cachedRotoFrames?.find((frame) => frame.appFrame === appFrame && frame.source === 'real-key')");
    expect(loadBlock).toContain('physicPaintStore.getFrame(context.layerId, appFrame)');
    expect(loadBlock).not.toContain('targetEngine.setBackgroundImageUrl(cachedFrame.dataUrl)');
    expect(loadBlock).toContain('targetEngine.resetBackground()');
    expect(text).toContain('cachedRotoReferenceUrl={cachedRotoReferenceUrl}');
    expect(text).toContain('class="physics-paint-cached-roto-reference"');
  });

  it('clears stale cached Roto reference overlays before navigation loads the destination frame', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));

    expect(navigateBlock).toContain('setCachedRotoReferenceUrl(null)');
    expect(navigateBlock.indexOf('setCachedRotoReferenceUrl(null)')).toBeLessThan(navigateBlock.indexOf('loadCachedRotoReferenceFrame(frame)'));
  });

  it('keeps workflow status messages from resizing the visible canvas row', () => {
    const css = styles();
    const studioRuleStart = css.indexOf('.physics-paint-studio {');
    const studioRule = css.slice(studioRuleStart, css.indexOf('}', studioRuleStart));
    const stripRuleStart = css.indexOf('.physics-paint-workflow-strip {');
    const stripRule = css.slice(stripRuleStart, css.indexOf('}', stripRuleStart));
    const statusRuleStart = css.indexOf('.physics-paint-roto-status-stack {');
    const statusRule = css.slice(statusRuleStart, css.indexOf('}', statusRuleStart));

    expect(studioRule).toContain('grid-template-rows: 58px minmax(0, 1fr) 256px');
    expect(studioRule).not.toContain('grid-template-rows: 58px minmax(0, 1fr) auto');
    expect(stripRule).toContain('height: 256px');
    expect(stripRule).toContain('overflow: hidden');
    expect(statusRule).toContain('min-height: 66px');
    expect(statusRule).toContain('max-height: 66px');
    expect(statusRule).toContain('overflow: hidden');
  });

  it('shows cached Roto references at full opacity while keeping them out of replacement exports', () => {
    const text = source();
    const css = styles();
    const cachedRotoRuleStart = css.lastIndexOf('.physics-paint-cached-roto-reference {');
    const cssRule = css.slice(cachedRotoRuleStart, css.indexOf('}', cachedRotoRuleStart));
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));

    expect(cssRule).not.toContain('opacity: 0.78');
    expect(cssRule).not.toMatch(/opacity:\s*0\.[0-9]+/);
    expect(cssRule).toContain('outline:');
    expect(flushBlock.indexOf('(engine as PreviewBackgroundEngine).resetBackground()')).toBeLessThan(flushBlock.indexOf('const renderedFrame = buildRotoOutputFrame(engine, frame, canvasWidth, canvasHeight)'));
    expect(flushBlock.indexOf('setCachedRotoReferenceUrl(null)')).toBeLessThan(flushBlock.indexOf('const renderedFrame = buildRotoOutputFrame(engine, frame, canvasWidth, canvasHeight)'));
  });

  it('keeps beforeunload snapshot-only while explicit Save current remains the cache write path', () => {
    const text = source();
    const saveBlock = text.slice(text.indexOf('const saveRotoFrame = useCallback'), text.indexOf('const updateSelectedPlayOptions = useCallback'));
    const beforeUnloadBlock = text.slice(text.indexOf('const handleBeforeUnload ='), text.indexOf('window.addEventListener(\'beforeunload\', handleBeforeUnload)'));

    expect(text).toContain('const saveRotoFrame = useCallback');
    expect(saveBlock).toContain('snapshotCurrentRotoFrame()');
    expect(saveBlock).toContain('dirtyRotoFramesRef.current.add(currentFrame)');
    expect(saveBlock).toContain('return flushRotoFrame(currentFrame, { force: true, advanceToFrame, onPayload: options.onPayload })');
    expect(beforeUnloadBlock).toContain('snapshotCurrentRotoFrame()');
    expect(beforeUnloadBlock).not.toContain('flushRotoFrame(currentFrame');
    expect(beforeUnloadBlock).not.toContain('event.preventDefault()');
    expect(beforeUnloadBlock).not.toContain('appWindow.close()');
    expect(text).toContain("window.addEventListener('beforeunload', handleBeforeUnload)");
    expect(text).toContain('appWindow.onCloseRequested');
    expect(text).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
  });

  it('grants the Physics Paint window permissions required by clean close', () => {
    const text = source();
    const tauriWindowApi = readFileSync(fileURLToPath(new URL('../../../node_modules/@tauri-apps/api/window.js', import.meta.url)), 'utf8');
    const capability = JSON.parse(readFileSync(defaultCapabilityPath, 'utf8')) as {
      windows?: string[];
      permissions?: unknown[];
    };

    expect(text).toContain('const appWindow = windowApi.getCurrentWindow()');
    expect(text).toContain('await appWindow.close()');
    expect(tauriWindowApi).toContain("return invoke('plugin:window|close'");
    expect(tauriWindowApi).toContain('await this.destroy()');
    expect(capability.windows).toContain('efx-physic-paint');
    expect(capability.permissions).toContain('core:window:allow-close');
    expect(capability.permissions).toContain('core:window:allow-destroy');
  });

  it('blocks only dirty current Roto native closes and renders the exact three explicit choices', () => {
    const text = source();
    const closeBlock = text.slice(text.indexOf('const closePhysicsPaintWindow = useCallback'), text.indexOf('const handlePhysicsPaintKeyDown = useCallback'));
    const promptBlock = text.slice(text.indexOf('physics-paint-roto-close-confirmation'), text.indexOf('{shortcutsVisible'));

    expect(text).toContain("type RotoClosePromptState = 'idle' | 'prompt' | 'saving' | 'error'");
    expect(text).toContain('const closeGuardBypassRef = useRef(false)');
    expect(closeBlock).toContain('snapshotCurrentRotoFrame()');
    expect(closeBlock).toContain("workflowMode === 'roto' && dirtyRotoFramesRef.current.has(currentFrame)");
    expect(closeBlock).toContain('event.preventDefault()');
    expect(closeBlock).toContain("setRotoClosePromptState('prompt')");
    expect(promptBlock).toContain('Close without saving');
    expect(promptBlock).toContain('Cancel');
    expect(promptBlock).toContain('Close saving');
    expect(promptBlock.match(/Close without saving/g)).toHaveLength(1);
    expect(promptBlock.match(/Close saving/g)).toHaveLength(1);
  });

  it('closes without saving by bypassing the guard without writing or deleting cached Roto output', () => {
    const text = source();
    const discardBlock = text.slice(text.indexOf('const closeWithoutSavingRotoFrame = useCallback'), text.indexOf('const cancelRotoClose = useCallback'));

    expect(discardBlock).toContain('closeGuardBypassRef.current = true');
    expect(discardBlock).toContain('closePhysicsPaintWindow()');
    expect(discardBlock).not.toContain('saveRotoFrame');
    expect(discardBlock).not.toContain('flushRotoFrame');
    expect(discardBlock).not.toContain('sendPhysicPaintApplyPayload');
    expect(discardBlock).not.toContain('applyCanvas');
    expect(discardBlock).not.toContain('delete-roto-frame');
  });

  it('cancels dirty close without closing or clearing dirty current-canvas state', () => {
    const text = source();
    const cancelBlock = text.slice(text.indexOf('const cancelRotoClose = useCallback'), text.indexOf('const saveAndCloseRotoFrame = useCallback'));

    expect(cancelBlock).toContain("setRotoClosePromptState('idle')");
    expect(cancelBlock).toContain('setRotoClosePromptMessage(null)');
    expect(cancelBlock).not.toContain('closePhysicsPaintWindow');
    expect(cancelBlock).not.toContain('dirtyRotoFramesRef.current.clear');
    expect(cancelBlock).not.toContain('dirtyRotoFramesRef.current.delete(currentFrame)');
    expect(cancelBlock).not.toContain('engine.clear()');
  });

  it('saves dirty close through Save current and closes only after the matching successful apply result', () => {
    const text = source();
    const saveCloseBlock = text.slice(text.indexOf('const saveAndCloseRotoFrame = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const saveAndCloseRotoFrame = useCallback')));
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    expect(text).toContain('const closeAfterApplyOperationIdRef = useRef<string | null>(null)');
    expect(text).toContain('const closeAfterRotoSaveRequestedRef = useRef(false)');
    expect(text).not.toContain('closeAfterRotoSaveReady');
    expect(saveCloseBlock).toContain('if (closeAfterRotoSaveRequestedRef.current) return');
    expect(saveCloseBlock).toContain('closeAfterRotoSaveRequestedRef.current = true');
    expect(saveCloseBlock).toContain('closeGuardBypassRef.current = true');
    expect(saveCloseBlock).toContain("setRotoClosePromptState('idle')");
    expect(saveCloseBlock).toContain('setRotoClosePromptMessage(null)');
    expect(saveCloseBlock).not.toContain("setRotoClosePromptState('saving')");
    expect(saveCloseBlock).not.toContain("setRotoClosePromptMessage('Saving current frame…')");
    expect(saveCloseBlock).toContain('const payload = await saveRotoFrame(null, {');
    expect(saveCloseBlock).toContain('onPayload: (payload) => {');
    expect(saveCloseBlock).toContain('closeAfterApplyOperationIdRef.current = payload.operationId');
    expect(saveCloseBlock).toContain("if (payload.kind === 'apply-canvas') payload.closeWindowAfterApply = true");
    expect(saveCloseBlock.indexOf('closeAfterApplyOperationIdRef.current = payload.operationId')).toBeLessThan(saveCloseBlock.indexOf('if (!payload?.operationId)'));
    expect(saveCloseBlock).not.toContain('closePhysicsPaintWindow()');
    expect(resultBlock).toContain('closeAfterRotoSaveRequestedRef.current && pendingApply?.operationId === detail.operationId');
    expect(resultBlock).toContain('if (shouldCloseAfterSave)');
    expect(resultBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(resultBlock).toContain('closeGuardBypassRef.current = true');
    expect(resultBlock).toContain('void closePhysicsPaintWindow()');
  });

  it('recovers dirty close prompt state after send errors, failed apply results, timeouts, and cleanup', () => {
    const text = source();
    const saveCloseBlock = text.slice(text.indexOf('const saveAndCloseRotoFrame = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const saveAndCloseRotoFrame = useCallback')));
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    const timeoutBlock = text.slice(text.indexOf('const startApplyTimeout = useCallback'), text.indexOf('const flushRotoFrame = useCallback'));
    const closeListenerBlock = text.slice(text.indexOf('appWindow.onCloseRequested'), text.indexOf('const handlePhysicsPaintKeyDown = useCallback'));
    const cleanupBlock = text.slice(text.indexOf('useEffect(() => {\n    return () => {\n      if (applyTimeoutRef.current)'), text.indexOf('const missingConditions = useMemo'));

    expect(closeListenerBlock).toContain('closeGuardBypassRef.current || closeAfterRotoSaveRequestedRef.current');
    expect(saveCloseBlock).toContain("setRotoClosePromptState('error')");
    expect(saveCloseBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(saveCloseBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(saveCloseBlock).toContain('closeGuardBypassRef.current = false');
    expect(resultBlock).toContain("setRotoClosePromptState('error')");
    expect(resultBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(resultBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(timeoutBlock).toContain("setRotoClosePromptState('error')");
    expect(timeoutBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(cleanupBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(cleanupBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(cleanupBlock).toContain('closeGuardBypassRef.current = false');
  });

  it('preserves dirty close-save continuation across the apply-result launch-context refresh', () => {
    const text = source();
    const applyIncomingBlock = text.slice(text.indexOf('const applyIncomingLaunchContext = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const applyIncomingLaunchContext = useCallback')));
    const resetBlock = text.slice(text.indexOf('const resetRotoSessionForLaunch = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const resetRotoSessionForLaunch = useCallback')));

    expect(applyIncomingBlock).toContain('const preserveCloseAfterRotoSave = closeAfterRotoSaveRequestedRef.current');
    expect(applyIncomingBlock).toContain('resetRotoSessionForLaunch(context, { preserveCloseAfterRotoSave })');
    expect(applyIncomingBlock).toContain('if (!preserveCloseAfterRotoSave) {');
    expect(resetBlock).toContain('options: { preserveCloseAfterRotoSave?: boolean } = {}');
    expect(resetBlock).toContain('if (!options.preserveCloseAfterRotoSave) {');
    expect(resetBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(resetBlock).toContain(`if (!options.preserveCloseAfterRotoSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingApplyRef.current = null;
    }
    rotoFlushInFlightRef.current = null;`);
  });

  it('keeps the explicit Save current path on the normal single-frame apply-canvas flow', () => {
    const text = source();
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));
    const saveBlock = text.slice(text.indexOf('const saveRotoFrame = useCallback'), text.indexOf('const updateSelectedPlayOptions = useCallback'));

    expect(saveBlock).toContain('flushRotoFrame(currentFrame, { force: true, advanceToFrame, onPayload: options.onPayload })');
    expect(saveBlock).not.toContain('savePendingRotoFrames()');
    expect(saveBlock).not.toContain('savePlay()');
    expect(flushBlock).toContain("kind: 'apply-canvas'");
    expect(flushBlock).toContain('renderedFrame,');
    expect(flushBlock).toContain('await sendPhysicPaintApplyPayload(payload, bridgeMode)');
    expect(saveBlock).not.toContain('buildRotoOutputFrame');
    expect(saveBlock).not.toContain('getRotoCachedPlaybackFrames');
  });

  it('keeps saved Roto PNGs in the standalone cache for navigation reference after Save current', () => {
    const text = source();
    const upsertHelperBlock = text.slice(text.indexOf('function upsertCachedRotoCacheFrame'), text.indexOf('function removeCachedRotoCacheFrame'));
    const upsertCallbackBlock = text.slice(text.indexOf('const upsertCachedRotoFrameInLaunchContext = useCallback'), text.indexOf('const removeCachedRotoFrameFromLaunchContext = useCallback'));
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));

    expect(text).toContain('const upsertCachedRotoFrameInLaunchContext = useCallback');
    expect(upsertHelperBlock).toContain("source: 'real-key'");
    expect(upsertCallbackBlock).toContain('cachedRotoFrames: upsertCachedRotoCacheFrame');
    expect(flushBlock).toContain('upsertCachedRotoFrameInLaunchContext(renderedFrame, backgroundOnly)');
    expect(flushBlock).not.toContain('savePendingRotoFrames()');
  });

  it('persists paper/background-only Roto frames without marking them editable-session pink', () => {
    const text = source();
    const predicateBlock = text.slice(text.indexOf('function shouldPersistRotoFrame'), text.indexOf('function addOccupiedRotoFrame'));
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));

    expect(predicateBlock).toContain("state.strokes.length > 0 || state.settings.bgMode !== 'transparent'");
    expect(predicateBlock).toContain("state.strokes.length === 0 && state.settings.bgMode !== 'transparent'");
    expect(flushBlock).toContain('const backgroundOnly = isBackgroundOnlyRotoFrame(editableState)');
    expect(flushBlock).toContain('if (backgroundOnly) {');
    expect(flushBlock).toContain('removeEditableRotoFrame(frame)');
    expect(flushBlock).toContain('} else {');
    expect(flushBlock).toContain('addEditableRotoFrame(frame)');
    expect(flushBlock).toContain('...(backgroundOnly ? { backgroundOnly: true } : {})');
  });

  it('passes editable real-key Roto frames separately from occupied/background-only frames', () => {
    const text = source();
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));
    const snapshotBlock = text.slice(text.indexOf('const snapshotCurrentRotoFrame = useCallback'), text.indexOf('const toggleRotoCachedPlayback'));

    expect(text).toContain('const [editableRotoFrames, setEditableRotoFrames] = useState<number[]>([])');
    expect(text).toContain('function hasEditableRotoContent');
    expect(snapshotBlock).toContain('if (cachedRotoReferenceUrl && !dirtyRotoFramesRef.current.has(appFrame))');
    expect(snapshotBlock).toContain('rotoFrameStatesRef.current.delete(appFrame)');
    expect(snapshotBlock).toContain('rotoPreviewFramesRef.current.delete(appFrame)');
    expect(snapshotBlock).toContain('if (hasEditableRotoContent(currentState)) addEditableRotoFrame(appFrame)');
    expect(snapshotBlock).toContain('else removeEditableRotoFrame(appFrame)');
    expect(snapshotBlock).not.toContain('addEditableRotoFrame(appFrame)\n    return true');
    expect(workflowStripBlock).toContain('occupiedRotoFrames={occupiedRotoFrames}');
    expect(workflowStripBlock).toContain('editableRotoFrames={editableRotoFrames}');
    expect(workflowStripBlock).not.toContain('editableRotoFrames={occupiedRotoFrames}');
  });

  it('tracks dirty Roto frames without autosaving before synced navigation', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));

    expect(text).toContain('const dirtyRotoFramesRef = useRef<Set<number>>(new Set())');
    expect(text).toContain('const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null)');
    expect(text).toContain('const flushRotoFrame = useCallback(async (frame: number');
    expect(text).toContain('dirtyRotoFramesRef.current.add(appFrame)');
    expect(navigateBlock).toContain('snapshotCurrentRotoFrame()');
    expect(navigateBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(navigateBlock).not.toContain('await flushRotoFrame(previousFrame');
    expect(text).not.toContain('onPointerMoveCapture={');
  });

  it('routes Phase 36.6 save-on-leave Roto navigation through one leave-boundary coordinator (D-01, D-02, D-03, D-05)', () => {
    const text = source();
    const coordinatorBlock = text.slice(text.indexOf('const requestRotoFrameNavigation = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));
    const keyboardBlock = text.slice(text.indexOf('const handlePhysicsPaintKeyDown = useCallback'), text.indexOf('const onionPreviewFrames = buildOnionPreviewFrames'));
    const frameNavStart = text.indexOf('const goToFirstFrame = useCallback');
    const frameNavBlock = text.slice(frameNavStart, text.indexOf('return (', frameNavStart));
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));

    expect(text).toContain('const requestRotoFrameNavigation = useCallback');
    expect(coordinatorBlock).toContain('if (!Number.isInteger(targetFrame) || targetFrame < 0) return false');
    expect(coordinatorBlock).toContain('snapshotCurrentRotoFrame()');
    expect(coordinatorBlock).toContain('const sourceFrame = currentFrame');
    expect(coordinatorBlock).toContain('const sourceIsDirty = dirtyRotoFramesRef.current.has(sourceFrame)');
    expect(coordinatorBlock).toContain('if (!sourceIsDirty) return navigateToSyncedFrame(targetFrame)');
    expect(coordinatorBlock).toContain('flushRotoFrame(sourceFrame, { force: true, advanceToFrame: targetFrame })');
    expect(coordinatorBlock).toContain('pendingRotoAdvanceRef.current = targetFrame');
    expect(coordinatorBlock).toContain('const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current');
    expect(coordinatorBlock).toContain('if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current)');
    expect(coordinatorBlock).toContain('saveOnLeaveSourceFrameRef.current = sourceFrame');
    expect(navigateBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(navigateBlock).not.toContain('flushRotoFrame(sourceFrame');
    expect(frameNavBlock).toContain('void requestRotoFrameNavigation(0)');
    expect(frameNavBlock).toContain('void requestRotoFrameNavigation(Math.max(0, currentFrame - 1))');
    expect(frameNavBlock).toContain('void requestRotoFrameNavigation(currentFrame + 1)');
    expect(frameNavBlock).toContain('void requestRotoFrameNavigation(Math.max(currentFrame, highestSavedFrame, playEndFrame, framesToApply - 1))');
    expect(keyboardBlock).toContain('void requestRotoFrameNavigation(nextFrame)');
    expect(keyboardBlock).toContain('void requestRotoFrameNavigation(currentFrame)');
    expect(keyboardBlock).not.toContain('void navigateToSyncedFrame(nextFrame)');
    expect(workflowStripBlock).toContain('onNavigateToSyncedFrame={(frame) => { void requestRotoFrameNavigation(frame); }}');
    expect(workflowStripBlock).toContain('onGoToFirstFrame={goToFirstFrame}');
    expect(workflowStripBlock).toContain('onGoToPreviousFrame={goToPreviousFrame}');
    expect(workflowStripBlock).toContain('onGoToNextFrame={goToNextFrame}');
    expect(workflowStripBlock).toContain('onGoToLastFrame={goToLastFrame}');
  });

  it('advances queued Roto save-on-leave destination across stale applyStatus state (D-02, D-03, D-08, D-10, D-11, D-12, D-14)', () => {
    const text = source();
    const coordinatorBlock = text.slice(text.indexOf('const requestRotoFrameNavigation = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));
    const internalAdvanceBlock = text.slice(text.indexOf('const openSyncedRotoFrameAfterSave = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    const saveBlock = text.slice(text.indexOf('const saveRotoFrame = useCallback'), text.indexOf('const updateSelectedPlayOptions = useCallback'));

    expect(text).toContain('const openSyncedRotoFrameAfterSave = useCallback');
    expect(navigateBlock).toContain("if (rotoFlushInFlightRef.current || applyStatus === 'applying') return false");
    expect(internalAdvanceBlock).toContain('stopRotoCachedPlayback()');
    expect(internalAdvanceBlock).toContain('setCachedRotoPlaybackFrame(null)');
    expect(internalAdvanceBlock).toContain('loadCachedRotoReferenceFrame(frame)');
    expect(internalAdvanceBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(internalAdvanceBlock).toContain('setLaunchContext((current) => current ? { ...current, startFrame: frame } : current)');
    expect(internalAdvanceBlock).not.toContain("applyStatus === 'applying'");
    expect(internalAdvanceBlock).not.toContain('rotoFlushInFlightRef.current');
    expect(resultBlock).toContain('void openSyncedRotoFrameAfterSave(nextFrame).then(() => {');
    expect(resultBlock).not.toContain('void navigateToSyncedFrame(nextFrame)');
    expect(resultBlock).toContain('const nextFrame = pendingRotoAdvanceRef.current');
    expect(resultBlock).toContain('pendingRotoAdvanceRef.current = null');
    expect(resultBlock).toContain('if (!detail.ok)');
    expect(resultBlock).toContain('saveOnLeaveRenderedFrameRef.current = null');
    expect(coordinatorBlock).toContain('const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current');
    expect(coordinatorBlock).toContain('if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current)');
    expect(coordinatorBlock).toContain('pendingRotoAdvanceRef.current = targetFrame');
    expect(coordinatorBlock).toContain('return false');
    expect(coordinatorBlock).not.toContain('if (saveOnLeaveSourceFrameRef.current !== null && rotoFlushInFlightRef.current)');
    expect(saveBlock).toContain('return flushRotoFrame(currentFrame, { force: true, advanceToFrame, onPayload: options.onPayload })');
    expect(text).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
  });

  it('keeps Phase 36.6 failed save-on-leave on the dirty source and clears queued navigation (D-10, D-11, D-12)', () => {
    const text = source();
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    const timeoutBlock = text.slice(text.indexOf('const startApplyTimeout = useCallback'), text.indexOf('const flushRotoFrame = useCallback'));

    expect(resultBlock).toContain('const nextFrame = pendingRotoAdvanceRef.current');
    expect(resultBlock).toContain('if (!detail.ok)');
    expect(resultBlock).toContain('pendingRotoAdvanceRef.current = null');
    expect(resultBlock).toContain('saveOnLeaveSourceFrameRef.current');
    expect(resultBlock).toContain('saveOnLeaveRenderedFrameRef.current = null');
    expect(resultBlock).toContain('saveOnLeaveDeleteFrameRef.current = null');
    expect(resultBlock).toContain('Could not save frame');
    expect(resultBlock).toContain('try navigating again to retry');
    expect(resultBlock.indexOf('return;')).toBeLessThan(resultBlock.indexOf('void openSyncedRotoFrameAfterSave(nextFrame)'));
    expect(timeoutBlock).toContain('pendingRotoAdvanceRef.current = null');
    expect(timeoutBlock).toContain('saveOnLeaveSourceFrameRef.current');
    expect(timeoutBlock).toContain('Could not save frame');
    expect(text).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
    expect(text).toContain('const closeAfterApplyOperationIdRef = useRef<string | null>(null)');
  });

  it('clears save-on-leave source tracking on terminal paths while preserving the apply-result origin guard (D-12, D-16)', () => {
    const text = source();
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    const timeoutBlock = text.slice(text.indexOf('const startApplyTimeout = useCallback'), text.indexOf('const flushRotoFrame = useCallback'));
    const listenerBlock = text.slice(text.indexOf('const handleMessageResult ='), text.indexOf('window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT'));

    expect(resultBlock).toContain('saveOnLeaveSourceFrameRef.current = null');
    expect(resultBlock).toContain('saveOnLeaveRenderedFrameRef.current = null');
    expect(resultBlock).toContain('saveOnLeaveDeleteFrameRef.current = null');
    expect(timeoutBlock).toContain('saveOnLeaveSourceFrameRef.current = null');
    expect(listenerBlock).toContain('if (event.origin !== window.location.origin) return');
    expect(listenerBlock).toContain('isPhysicPaintApplyResultMessage(event.data)');
  });

  it('validates apply result kind and frame before clearing Roto save-on-leave state', () => {
    const text = source();
    const flushBlock = text.slice(text.indexOf('const flushRotoFrame = useCallback'), text.indexOf('const navigateToSyncedFrame = useCallback'));
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));

    expect(text).toContain("const pendingApplyRef = useRef<Pick<PhysicPaintApplyPayload, 'operationId' | 'kind' | 'startFrame'> | null>(null)");
    const savePlayBlock = text.slice(text.indexOf('const savePlay = useCallback'), text.indexOf('const savePendingRotoFrames = useCallback'));

    expect(flushBlock).toContain('pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: frame }');
    expect(savePlayBlock).toContain('pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame }');
    expect(savePlayBlock.indexOf('pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame }')).toBeLessThan(savePlayBlock.indexOf('await sendPhysicPaintApplyPayload(payload, bridgeMode)'));
    expect(resultBlock).toContain('const pendingApply = pendingApplyRef.current');
    expect(resultBlock).toContain('detail.kind !== pendingApply.kind || detail.startFrame !== pendingApply.startFrame');
    expect(resultBlock.indexOf('detail.kind !== pendingApply.kind')).toBeLessThan(resultBlock.indexOf('activeOperationIdRef.current = null'));
    expect(resultBlock).toContain('pendingApplyRef.current = null');
  });

  it('does not mark deleted Roto save-on-leave frames as saved after successful apply', () => {
    const text = source();
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));

    expect(resultBlock).toContain('const deletedFrame = saveOnLeaveDeleteFrameRef.current === frame');
    expect(resultBlock).toContain('if (deletedFrame) {');
    expect(resultBlock).toContain('setSavedRotoFrames((frames) => frames.filter((savedFrame) => savedFrame.frame !== frame))');
    expect(resultBlock).toContain('setOccupiedRotoFrames((frames) => frames.filter((occupiedFrame) => occupiedFrame !== frame))');
    expect(resultBlock).toContain('removeEditableRotoFrame(frame)');
    expect(resultBlock.indexOf('if (deletedFrame) {')).toBeLessThan(resultBlock.indexOf('setSavedRotoFrames((frames) => [\n          ...frames.filter'));
  });

  it('disables Roto canvas input while save-on-leave is applying', () => {
    const text = source();
    const canvasBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('</PhysicsPaintCanvasStack>'));

    expect(text).toContain("const rotoInputDisabled = workflowMode === 'roto' && Boolean(saveOnLeaveSourceFrameRef.current) && applyStatus === 'applying'");
    expect(canvasBlock).toContain('inputDisabled={rotoInputDisabled}');
    expect(canvasBlock).toContain('inputDisabledMessage="Saving current Roto frame…"');
  });

  it('wires explicit current-frame Roto saves without repeated brush-move apply calls', () => {
    const text = source();
    const canvasBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('</PhysicsPaintCanvasStack>'));
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));

    expect(text).toContain('const [pendingRotoFrames, setPendingRotoFrames] = useState<number[]>([])');
    expect(text).toContain('const markCurrentRotoFrameDirty = useCallback');
    expect(text).toContain('const beginRotoFrameEdit = useCallback');
    expect(canvasBlock).toContain('onInputIntent={workflowMode === \'play\' ? beginPlayFrameEdit : beginRotoFrameEdit}');
    expect(workflowStripBlock).toContain('pendingRotoFrames={pendingRotoFrames}');
    expect(workflowStripBlock).toContain('rotoSaveInFlight={Boolean(rotoFlushInFlightRef.current) || applyStatus === \'applying\'}');
    expect(workflowStripBlock).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
  });

  it('keeps real-key utility helpers out of the strict Phase 36.3 Roto strip surface', () => {
    const text = source();
    const workflowStripBlock = text.slice(text.indexOf('<PhysicsPaintWorkflowStrip'), text.indexOf('{shortcutsVisible'));
    const shortcutsBlock = text.slice(text.indexOf('{shortcutsVisible'), text.indexOf('</section>'));

    for (const label of ['duplicateRotoKey', 'insertRotoFrame', 'deleteRotoFrame', 'copyRotoFrame', 'pasteRotoFrame']) {
      expect(text).toContain(label);
    }
    expect(workflowStripBlock).toContain('onDuplicateRotoKey={duplicateRotoKey}');
    expect(workflowStripBlock).toContain('onInsertRotoFrame={insertRotoFrame}');
    expect(workflowStripBlock).toContain('onDeleteRotoFrame={deleteRotoFrame}');
    expect(workflowStripBlock).toContain('onCopyRotoFrame={copyRotoFrame}');
    expect(workflowStripBlock).toContain('onPasteRotoFrame={pasteRotoFrame}');
    expect(workflowStripBlock).toContain('hasCopiedRotoKey={hasCopiedRotoKey}');
    expect(shortcutsBlock).not.toContain('Duplicate key');
    expect(shortcutsBlock).not.toContain('Insert frame');
    expect(shortcutsBlock).not.toContain('Delete frame');
    expect(shortcutsBlock).not.toContain('Copy frame');
    expect(shortcutsBlock).not.toContain('Paste frame');
    expect(text).toContain('const [hasCopiedRotoKey, setHasCopiedRotoKey]');
    expect(text).toContain('deriveRotoKeyUtilityActionState');
    expect(text).toContain('const requireCurrentRealRotoKey = useCallback');
    expect(text).toContain("setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');");
    expect(text).toContain('physicPaintStore.regenerateRotoInterpolationCache');
    expect(text).not.toContain("rotoFrameStatesRef.current.set(result.targetFrame, { source: 'generated-interpolation'");
    expect(text).not.toContain('getNearestRealRotoKeyFrame(currentFrame, physicPaintStore.getRealRotoKeyFrames(launchContext.layerId))');
  });
});
