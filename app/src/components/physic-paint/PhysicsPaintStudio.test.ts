import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const topBarPath = fileURLToPath(new URL('./PhysicsPaintTopBar.tsx', import.meta.url));
const stylePath = fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url));
const bridgePath = fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url));
const source = () => readFileSync(sourcePath, 'utf8');
const topBarSource = () => readFileSync(topBarPath, 'utf8');
const styles = () => readFileSync(stylePath, 'utf8');
const bridgeSource = () => readFileSync(bridgePath, 'utf8');

describe('PhysicsPaintStudio onion preview contract', () => {
  it('captures transparent stroke previews instead of full paper composite snapshots', () => {
    const text = source();

    expect(text).toContain('function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement');
    expect(text).toContain("engine.setBgMode('transparent')");
    expect(text).toContain('return engine.exportCompositeCanvas()');
    expect(text).toContain('engine.load(state)');
    expect(text).toContain('function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(engine.exportCompositeCanvas(), appFrame)');
    expect(text).toContain('function buildRotoOnionPreviewFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload');
    expect(text).toContain('return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame)');
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

  it('keeps transparent onion strokes visible over paper instead of screening them out', () => {
    const css = styles();

    expect(css).toContain('mix-blend-mode: multiply');
    expect(css).not.toContain('mix-blend-mode: screen');
  });

  it('sends paper composite frames to EFX Motion while caching transparent onion previews', () => {
    const text = source();
    const saveRotoBlock = text.slice(text.indexOf('const saveRotoFrame = useCallback'), text.indexOf('const savePlay = useCallback'));

    expect(saveRotoBlock).toContain('const renderedFrame = buildRotoOutputFrame(engine, currentFrame)');
    expect(saveRotoBlock).toContain('rotoPreviewFramesRef.current.set(currentFrame, buildRotoOnionPreviewFrame(engine, currentFrame))');
    expect(saveRotoBlock).toContain('renderedFrame,');
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
    expect(text).toContain('applyLaunchContext(storedContext, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle, setSettings)');
    expect(text).toContain('applyLaunchContext(event.payload, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle, setSettings)');
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
    const localPreviewBlock = text.slice(text.indexOf('const previewLocalPlayFrame = useCallback'), text.indexOf('const startApplyTimeout'));

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
    expect(text).toContain('onInputIntent={beginPlayFrameEdit}');
    expect(text).not.toContain('inputDisabled={!canEditCurrentPlayFrame}');
    expect(saveEditableStateBlock).toContain('capturePendingPlayFrameEdits()');
    expect(saveEditableStateBlock).toContain('annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current)');
    expect(saveEditableStateBlock).toContain('downloadPhysicsPaintState(editableState)');
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

  it('saves Play using selected script range and clears dirty cache status after regenerated frames publish', () => {
    const text = source();
    const savePlayBlock = text.slice(text.indexOf('const savePlay = useCallback'), text.indexOf('const saveRotoFrameAndAdvance'));

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
    expect(savePlayBlock).not.toContain('strokeStyleOverride');
    expect(text).not.toContain('function buildPlayStrokeStyleOverride');
  });
});
