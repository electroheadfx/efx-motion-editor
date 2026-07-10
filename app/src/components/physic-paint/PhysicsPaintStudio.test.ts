import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('./PhysicsPaintStudio.tsx', import.meta.url));
const topBarPath = fileURLToPath(new URL('./PhysicsPaintTopBar.tsx', import.meta.url));
const stylePath = fileURLToPath(new URL('./physicsPaintStudio.css', import.meta.url));
const defaultCapabilityPath = fileURLToPath(new URL('../../../src-tauri/capabilities/default.json', import.meta.url));
const bridgePath = fileURLToPath(new URL('../../lib/physicPaintBridge.ts', import.meta.url));
const enginePath = fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts', import.meta.url));
const packageTypesPath = fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/types.ts', import.meta.url));
const preactWrapperPath = fileURLToPath(new URL('../../../../packages/efx-physic-paint/src/preact.tsx', import.meta.url));
const rotoSessionPath = fileURLToPath(new URL('./physicsPaintRotoSession.ts', import.meta.url));
const rotoKeyUtilitiesPath = fileURLToPath(new URL('./useRotoKeyUtilities.ts', import.meta.url));
const rotoReferenceControllerPath = fileURLToPath(new URL('./useRotoReferenceController.ts', import.meta.url));
const rotoCacheTransactionsPath = fileURLToPath(new URL('./rotoCacheTransactions.ts', import.meta.url));
const rotoLaunchHydrationPath = fileURLToPath(new URL('./rotoLaunchHydration.ts', import.meta.url));
const rotoApplyLifecyclePath = fileURLToPath(new URL('./useRotoApplyLifecycle.ts', import.meta.url));
const rotoApplyTransactionsPath = fileURLToPath(new URL('./rotoApplyTransactions.ts', import.meta.url));
const rotoApplyResultControllerPath = fileURLToPath(new URL('./useRotoApplyResultController.ts', import.meta.url));
const rotoCloseLifecyclePath = fileURLToPath(new URL('./useRotoCloseLifecycle.ts', import.meta.url));
const rotoApplyResultTransactionsPath = fileURLToPath(new URL('./rotoApplyResultTransactions.ts', import.meta.url));
const rotoSaveControllerPath = fileURLToPath(new URL('./useRotoSaveController.ts', import.meta.url));
const rotoSaveTransactionsPath = fileURLToPath(new URL('./rotoSaveTransactions.ts', import.meta.url));
const rotoEditBufferControllerPath = fileURLToPath(new URL('./useRotoEditBufferController.ts', import.meta.url));
const rotoEditBufferTransactionsPath = fileURLToPath(new URL('./rotoEditBufferTransactions.ts', import.meta.url));
const playFrameTransactionsPath = fileURLToPath(new URL('./playFrameTransactions.ts', import.meta.url));
const playEditCacheControllerPath = fileURLToPath(new URL('./usePlayEditCacheController.ts', import.meta.url));
const playPreviewControllerPath = fileURLToPath(new URL('./usePlayPreviewController.ts', import.meta.url));
const playLifecycleTransactionsPath = fileURLToPath(new URL('./playLifecycleTransactions.ts', import.meta.url));
const rotoPlayConversionTransactionsPath = fileURLToPath(new URL('./rotoPlayConversionTransactions.ts', import.meta.url));
const rotoPlayConversionControllerPath = fileURLToPath(new URL('./useRotoPlayConversionController.ts', import.meta.url));
const engineLifecyclePath = fileURLToPath(new URL('./usePhysicsPaintEngineLifecycle.ts', import.meta.url));
const sessionControllerPath = fileURLToPath(new URL('./usePhysicsPaintSessionController.ts', import.meta.url));
const canvasMountPath = fileURLToPath(new URL('./PhysicsPaintCanvasMount.tsx', import.meta.url));
const onionPreviewPath = fileURLToPath(new URL('./rotoOnionPreview.ts', import.meta.url));
const studioSelectorsPath = fileURLToPath(new URL('./physicsPaintStudioSelectors.ts', import.meta.url));
const playLimitToastPath = fileURLToPath(new URL('./usePlayLimitToast.ts', import.meta.url));
const rotoNavigationActionsPath = fileURLToPath(new URL('./rotoNavigationActions.ts', import.meta.url));
const canvasSizingPath = fileURLToPath(new URL('./physicsPaintCanvasSizing.ts', import.meta.url));
const parentBridgePath = fileURLToPath(new URL('./usePhysicsPaintParentBridge.ts', import.meta.url));
const launchContextPath = fileURLToPath(new URL('./physicsPaintLaunchContext.ts', import.meta.url));
const source = () => `${readFileSync(sourcePath, 'utf8')}\n${rotoCloseLifecycleSource()}\n${rotoSaveControllerSource()}\n${rotoSaveTransactionsSource()}\n${rotoEditBufferControllerSource()}\n${rotoEditBufferTransactionsSource()}\n${playFrameTransactionsSource()}\n${playEditCacheControllerSource()}\n${playPreviewControllerSource()}\n${playLifecycleTransactionsSource()}\n${engineLifecycleSource()}\n${canvasMountSource()}\n${canvasSizingSource()}`;
const topBarSource = () => readFileSync(topBarPath, 'utf8');
const styles = () => readFileSync(stylePath, 'utf8');
const bridgeSource = () => readFileSync(bridgePath, 'utf8');
const engineSource = () => readFileSync(enginePath, 'utf8');
const packageTypesSource = () => readFileSync(packageTypesPath, 'utf8');
const preactWrapperSource = () => readFileSync(preactWrapperPath, 'utf8');
const rotoSessionSource = () => readFileSync(rotoSessionPath, 'utf8');
const rotoKeyUtilitiesSource = () => readFileSync(rotoKeyUtilitiesPath, 'utf8');
const rotoReferenceControllerSource = () => readFileSync(rotoReferenceControllerPath, 'utf8');
const rotoCacheTransactionsSource = () => readFileSync(rotoCacheTransactionsPath, 'utf8');
const rotoLaunchHydrationSource = () => readFileSync(rotoLaunchHydrationPath, 'utf8');
const rotoApplyLifecycleSource = () => readFileSync(rotoApplyLifecyclePath, 'utf8');
const rotoApplyTransactionsSource = () => readFileSync(rotoApplyTransactionsPath, 'utf8');
const rotoApplyResultControllerSource = () => readFileSync(rotoApplyResultControllerPath, 'utf8');
const rotoCloseLifecycleSource = () => readFileSync(rotoCloseLifecyclePath, 'utf8');
const rotoApplyResultTransactionsSource = () => readFileSync(rotoApplyResultTransactionsPath, 'utf8');
const rotoSaveControllerSource = () => readFileSync(rotoSaveControllerPath, 'utf8');
const rotoSaveTransactionsSource = () => readFileSync(rotoSaveTransactionsPath, 'utf8');
const rotoEditBufferControllerSource = () => readFileSync(rotoEditBufferControllerPath, 'utf8');
const rotoEditBufferTransactionsSource = () => readFileSync(rotoEditBufferTransactionsPath, 'utf8');
const playFrameTransactionsSource = () => readFileSync(playFrameTransactionsPath, 'utf8');
const playEditCacheControllerSource = () => readFileSync(playEditCacheControllerPath, 'utf8');
const playPreviewControllerSource = () => readFileSync(playPreviewControllerPath, 'utf8');
const playLifecycleTransactionsSource = () => readFileSync(playLifecycleTransactionsPath, 'utf8');
const rotoPlayConversionTransactionsSource = () => readFileSync(rotoPlayConversionTransactionsPath, 'utf8');
const rotoPlayConversionControllerSource = () => readFileSync(rotoPlayConversionControllerPath, 'utf8');
const engineLifecycleSource = () => readFileSync(engineLifecyclePath, 'utf8');
const sessionControllerSource = () => readFileSync(sessionControllerPath, 'utf8');
const canvasMountSource = () => readFileSync(canvasMountPath, 'utf8');
const canvasSizingSource = () => readFileSync(canvasSizingPath, 'utf8');
const parentBridgeSource = () => readFileSync(parentBridgePath, 'utf8');
const launchContextSource = () => readFileSync(launchContextPath, 'utf8');

function getUseEffectBlocks(text: string): string[] {
  const blocks: string[] = [];
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('useEffect(() => {', index);
    if (start === -1) break;
    let cursor = start;
    let depth = 0;
    let end = start;
    while (cursor < text.length) {
      const char = text[cursor];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end = text.indexOf(');', cursor);
          break;
        }
      }
      cursor += 1;
    }
    blocks.push(text.slice(start, end === -1 ? cursor + 1 : end + 2));
    index = end === -1 ? cursor + 1 : end + 2;
  }
  return blocks;
}

describe('PhysicsPaintStudio Roto session boundary contract', () => {
  it('36.13/D-05/D-09 wires far-empty saves through source-target compression and keeps generated saves render-only', () => {
    const text = source();
    const saveBlock = rotoSaveControllerSource();
    const flushBlock = rotoSaveControllerSource();

    expect(text).not.toContain('function mergeRotoSegmentSpacingOverride');
    expect(text).not.toContain('function resolveRotoSaveTargetForDisplayFrame');
    expect(saveBlock).toContain('input.getCurrentFrameIsGenerated()');
    expect(rotoSaveTransactionsSource()).toContain('Generated frame ${input.currentFrame} is render-only');
    expect(saveBlock).toContain('const saveTransaction = input.getCurrentFrameIsGenerated() ? null : input.saveRealKeyAtDisplayFrame(currentFrame)');
    expect(saveBlock).toContain('sourceFrameOverride: saveTransaction.sourceFrameOverride');
    expect(saveBlock).toContain('rotoInterpolationSettings: saveTransaction.interpolationSettings');
    expect(saveBlock).not.toContain('resolveRotoSaveTargetForDisplayFrame(currentFrame');
    expect(saveBlock).not.toContain('segmentSpacingOverrides: mergeRotoSegmentSpacingOverride');
    expect(saveBlock).not.toContain('PHYSIC_PAINT_MAX_APPLY_FRAMES');
    expect(flushBlock).toContain('resolveRotoSaveSourceFrame(frame, options.sourceFrameOverride, input.resolveSourceFrame(frame))');
    expect(rotoSaveTransactionsSource()).toContain('sourceFrameOverride?: number');
  });

  it('36.13/D-08/D-12 persists transaction segment spacing overrides before local/generated cache refresh', () => {
    const text = source();
    const applyBlock = text.slice(text.indexOf('const applyRotoKeyFrames = useCallback'), text.indexOf('const persistRotoKeyFrameTransaction = useCallback'));
    const persistBlock = text.slice(text.indexOf('const persistRotoKeyFrameTransaction = useCallback'), text.indexOf('const restoreRotoFrameFromSessionEffect'));

    expect(text).toContain('useRotoKeyUtilities');
    expect(applyBlock).toContain('physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, { segmentSpacingOverrides: [...transaction.segmentSpacingOverrides] })');
    expect(applyBlock).toContain('physicPaintStore.getRotoCacheFrames(launchContext.layerId)');
    expect(persistBlock).toContain('rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId)');
  });

  it('uses store display-frame Roto cache while interpolation is enabled', () => {
    const text = source();
    const updateBlock = text.slice(text.indexOf('const updateRotoInterpolationSettings = useCallback'), text.indexOf('const goToFirstFrame'));
    const cacheTransactions = rotoCacheTransactionsSource();
    const launchHydration = rotoLaunchHydrationSource();

    expect(text).toContain("from './rotoLaunchHydration'");
    expect(text).not.toContain('function seedStoreRotoRealKeysFromLaunchContext');
    expect(launchHydration).toContain('settings.enabled && storeFrames.length > 0');
    expect(launchHydration).toContain('? storeFrames');
    expect(updateBlock).toContain('refreshRotoInterpolationCache(');
    expect(updateBlock).toContain('transaction.settings.enabled');
    expect(cacheTransactions).toContain('storeFrames.length > 0');
    expect(cacheTransactions).toContain("storeFrames.filter((frame) => enabled || frame.source === 'real-key')");
  });

  it('D-03/D-17 consumes one compact key utility adapter boundary for Roto session state', () => {
    const text = source();
    const adapter = rotoKeyUtilitiesSource();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).toContain("from './useRotoKeyUtilities'");
    expect(adapter).toContain('createRotoSession');
    expect(text).toContain('const rotoSession = rotoKeyUtilities.session');
    expect(text).toContain('realKeyFrames: selectRealCachedRotoFrames(launchContext?.cachedRotoFrames)');
    expect(text).toContain('rotoSession.dirtyFrames.value');
    expect(text).toContain('rotoSession.actionAvailability.value');
    expect(workflowStripBlock).toContain('hasCopiedRotoKey={rotoSession.copiedKey.value !== null}');
    expect(workflowStripBlock).toContain('pendingRotoFrames={rotoSession.dirtyFrames.value}');
    expect(workflowStripBlock).not.toContain('copiedRotoKeyRef');
    expect(workflowStripBlock).not.toContain('dirtyRotoFramesRef');
  });

  it('36.8-REG-06/D-03/D-18 keeps WorkflowStrip wiring stable without adding individual Roto key/cache props', () => {
    const text = source();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    const rotoPropNames = [...workflowStripBlock.matchAll(/\n\s+(\w*(?:Roto|roto)\w*)=/g)].map((match) => match[1]);
    expect(rotoPropNames).toEqual([
      'occupiedRotoFrames',
      'savedRotoFrames',
      'cachedRotoFrames',
      'editableRotoFrames',
      'pendingRotoFrames',
      'rotoSaveInFlight',
      'rotoSavingFrame',
      'rotoCachedPlaybackAvailable',
      'rotoCachedPlaybackStatus',
      'rotoCachedPlaybackLoop',
      'rotoCachedPlaybackFps',
      'isRotoCachedPlaybackActive',
      'onToggleRotoPlayback',
      'onRotoPlaybackLoopChange',
      'onRotoPlaybackFpsChange',
      'rotoInterpolationSettings',
      'onRotoInterpolationEnabledChange',
      'onRotoInterpolationCountChange',
      'onDuplicateRotoKey',
      'onInsertRotoFrame',
      'onDeleteRotoFrame',
      'onCopyRotoFrame',
      'onPasteRotoFrame',
      'hasCopiedRotoKey',
      'rotoKeyState',
      'onSaveRotoFrame',
      'onSavePendingRotoFrames',
      'onConvertPlayToRoto',
      'onConvertRotoToPlay',
    ]);
    expect(workflowStripBlock).toContain('onDuplicateRotoKey={duplicateRotoKey}');
    expect(workflowStripBlock).toContain('onInsertRotoFrame={insertRotoFrame}');
    expect(workflowStripBlock).toContain('onDeleteRotoFrame={deleteRotoFrame}');
    expect(workflowStripBlock).toContain('onCopyRotoFrame={copyRotoFrame}');
    expect(workflowStripBlock).toContain('onPasteRotoFrame={pasteRotoFrame}');
  });

  it('D-07/D-17 executes session effects through the key utility adapter boundary', () => {
    const text = source();
    const adapter = rotoKeyUtilitiesSource();

    expect(text).toContain('type { RotoSessionEffect }');
    expect(adapter).toContain('const executeSessionEffects = useCallback(async');
    for (const descriptor of ['saveFrame', 'replaceKeys', 'restoreFrame', 'clearCanvas', 'showCachedReference', 'navigate']) {
      expect(adapter).toContain(`case '${descriptor}'`);
    }
    expect(text).toContain('handleSaveFrameEffect: async (effect) =>');
    expect(text).toContain('persistRotoKeyFrameTransaction');
    expect(text).toContain('restoreFrame: restoreRotoFrameFromSessionEffect');
    expect(text).toContain('navigate: openSyncedRotoFrameAfterSave');
  });

  it('36.8-REG-08 keeps effectless Copy inside the live session so Paste enables after click', () => {
    const adapter = rotoKeyUtilitiesSource();
    const resultBlock = adapter.slice(adapter.indexOf('const runSessionResult = useCallback'), adapter.indexOf('const requireCurrentRealKey'));

    expect(resultBlock).toContain('const hasSessionEffects = result.effects.length > 0');
    expect(resultBlock).toContain('if (hasSessionEffects) setKeyActionInFlight(true)');
    expect(resultBlock).toContain('if (hasSessionEffects) await executeSessionEffects(result.effects)');
    expect(resultBlock).toContain('if (hasSessionEffects) input.syncPendingRotoFrames()');
  });

  it('36.8-REG-07/D-17 does not add broad internal Roto key/cache/session useEffect orchestration', () => {
    const text = source();
    const effectBlocks = getUseEffectBlocks(text);
    const broadCoherenceEffects = effectBlocks.filter((block) => (
      /createRotoSession|rotoSession\.|RotoSessionEffect|RotoSessionActionResult|dirtyRotoFramesRef|copiedRotoKeyRef|pendingRotoAdvanceRef|saveOnLeaveSourceFrameRef|saveOnLeaveRenderedFrameRef|saveOnLeaveDeleteFrameRef/.test(block)
      && !/appWindow\.onCloseRequested|window\.addEventListener\('beforeunload'|PHYSIC_PAINT_APPLY_RESULT_EVENT|PHYSIC_PAINT_LAUNCH_EVENT|detectBridgeMode|tablet:pressure|cachedPlayPreview|pendingRotoAdvanceRef\.current|engineRef\.current|workflowModeRef\.current|localPlayPreviewFrameRef\.current/.test(block)
    ));

    expect(broadCoherenceEffects).toEqual([]);
  });

  it('D-02/D-13 keeps bridge/canvas/window APIs in focused external boundaries and out of the session boundary', () => {
    const text = source();
    const bridge = parentBridgeSource();
    const session = rotoSessionSource();

    expect(text).toContain('sendPhysicPaintApplyPayload');
    expect(text).toContain('sendPhysicPaintFrameSyncMessage');
    expect(text).toContain('usePhysicsPaintLaunchBridge(applyIncomingLaunchContext)');
    expect(text).toContain('usePhysicsPaintApplyResultBridge(bridgeMode, handleApplyResult)');
    expect(bridge).toContain("coreApi.invoke('get_physics_paint_launch_context')");
    expect(bridge).toContain('PHYSIC_PAINT_LAUNCH_EVENT');
    expect(bridge).toContain("event.origin !== window.location.origin");
    expect(bridge).toContain('isPhysicPaintApplyResult(event.payload)');
    expect(bridge).toContain('unlisten?.()');
    expect(launchContextSource()).toContain('applyPhysicsPaintLaunchContext');
    expect(text).toContain('appWindow.onCloseRequested');
    expect(text).toContain('engine.save()');
    expect(text).toContain('engine.load(');
    expect(session).not.toContain('@tauri-apps/api');
    expect(session).not.toContain('physicPaintBridge');
    expect(session).not.toContain('@efxlab/efx-physic-paint');
    expect(session).not.toContain('PhysicsPaintStudio');
  });
});

describe('PhysicsPaintStudio Play/Roto conversion boundary contract', () => {
  it('moves conversion payload plans and bridge lifecycle into the focused controller', () => {
    const text = source();
    const transactions = rotoPlayConversionTransactionsSource();
    const controller = rotoPlayConversionControllerSource();

    expect(text).toContain("from './useRotoPlayConversionController'");
    expect(text).toContain('const { convertPlayToRoto, convertRotoToPlay } = useRotoPlayConversionController');
    expect(text).not.toContain('const convertPlayToRoto = useCallback');
    expect(text).not.toContain('const convertRotoToPlay = useCallback');
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

    expect(studio).toContain("from './usePhysicsPaintEngineLifecycle'");
    expect(studio).toContain("from './PhysicsPaintCanvasMount'");
    expect(studio).toContain('const {\n    engine,\n    engineRef,\n    canvasMounted,');
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
  it('captures transparent Roto frames once and reuses that active-frame payload for save output and onion preview', () => {
    const text = source();
    const snapshotBlock = text.slice(text.indexOf('const snapshotCurrentRotoFrame = useCallback'), text.indexOf('const startRotoCachedPlayback'));
    const flushBlock = rotoSaveControllerSource();

    expect(text).toContain('function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement');
    expect(text).toContain("engine.setBgMode('transparent')");
    expect(text).toContain('return engine.exportCompositeCanvas()');
    expect(text).toContain('engine.load(state)');
    expect(text).toContain('const confirmedCachedRotoFramesRef = useRef<Map<number, RenderedFramePayload>>');
    expect(text).toContain('capturedFrames: new Map()');
    expect(snapshotBlock).toContain('? buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width: canvasWidth, height: canvasHeight })');
    expect(snapshotBlock).toContain('rotoEditBuffer.snapshotFrame({');
    expect(rotoEditBufferTransactionsSource()).toContain('buffer.capturedFrames.set(frame, input.capturedFrame)');
    expect(rotoEditBufferTransactionsSource()).toContain('buffer.previewFrames.set(frame, input.capturedFrame)');
    expect(flushBlock).toContain('const capturedFrame = input.getCapturedFrame(frame)');
    expect(flushBlock).toContain('input.renderFrame({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame })');
    expect(flushBlock).toContain('input.setPreviewFrame(frame, save.onionFrame ?? save.renderedFrame)');
    expect(flushBlock).not.toContain('buildRotoOnionPreviewFrame(engine, frame, canvasWidth, canvasHeight)');
  });

  it('sizes the standalone canvas shell from project canvas dimensions', () => {
    const text = source();
    const mountProbeBlock = canvasMountSource();

    expect(text).toContain('export const PHYSICS_PAINT_WORKING_LONG_EDGE = 1000');
    expect(text).toContain('function getPhysicsPaintWorkingSize(projectWidth: number, projectHeight: number): { width: number; height: number }');
    expect(text).toContain('const scale = Math.min(1, PHYSICS_PAINT_WORKING_LONG_EDGE / Math.max(projectWidth, projectHeight))');
    expect(text).toContain('const projectCanvasWidth = launchContext?.width ?? DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH');
    expect(text).toContain('const workingCanvasSize = getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight)');
    expect(text).toContain('function getContainedCanvasDisplaySize(containerWidth: number, containerHeight: number, canvasWidth: number, canvasHeight: number)');
    expect(mountProbeBlock).toContain('const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)');
    expect(mountProbeBlock).toContain('setDisplaySize(getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height))');
    expect(mountProbeBlock).toContain('style={{ aspectRatio: `${props.width} / ${props.height}`, ...(displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` } : {}) }}');
    expect(mountProbeBlock).toContain('width={props.width}');
    expect(mountProbeBlock).toContain('height={props.height}');
    expect(mountProbeBlock).toContain('paperTextureScale={props.paperTextureScale}');
    expect(text).toContain('const paperTextureScale = canvasWidth / projectCanvasWidth');
    expect(text).toContain('paperTextureScale={paperTextureScale}');
    expect(preactWrapperSource()).toContain('aspectRatio: `${props.width || 1000} / ${props.height || 650}`');
    expect(preactWrapperSource()).toContain('paperTextureScale: props.paperTextureScale');
    expect(packageTypesSource()).toContain('paperTextureScale?: number');
    expect(engineSource()).toContain('private readonly paperTextureScale: number');
    expect(engineSource()).toContain('loadPaperTexture(paper.url, this.width, this.height, this.paperTextureScale)');
  });

  it('rescales editable project states into the bounded working canvas before loading them', () => {
    const text = source();

    expect(text).toContain('export function resizePhysicsPaintState(state: SerializedPhysicsPaintProject, width: number, height: number): SerializedPhysicsPaintProject');
    expect(text).toContain('const scaleX = width / state.width');
    expect(text).toContain('const scaleY = height / state.height');
    expect(text).toContain('engine.load(resizePhysicsPaintState(input.launchContext.editableState, input.canvasWidth, input.canvasHeight))');
    expect(sessionControllerSource()).toContain('const state = resizePhysicsPaintState(');
    expect(sessionControllerSource()).toContain('parsePhysicsPaintStateFile(contents)');
    expect(sessionControllerSource()).toContain('input.canvasSize.width');
    expect(sessionControllerSource()).toContain('input.canvasSize.height');
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

  it('keeps reference overlays above the base canvas but below the live paint cursor and stroke preview', () => {
    const css = styles();

    expect(css).toContain('.demo-canvas-shell .paint-canvas canvas {\n  z-index: 2 !important;');
    expect(css).toContain('.physics-paint-onion-overlay.canvas-region {\n  inset: auto;\n  z-index: 3;');
    expect(css).toContain('.demo-canvas-shell .paint-canvas canvas + canvas {\n  z-index: 4 !important;');
    expect(css).toContain('mix-blend-mode: multiply');
    expect(css).not.toContain('mix-blend-mode: screen');
  });

  it('sends transparent Roto frames to EFX Motion while caching transparent onion previews', () => {
    const flushBlock = rotoSaveControllerSource();

    expect(flushBlock).toContain('input.renderFrame({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame })');
    expect(flushBlock).toContain('input.setPreviewFrame(frame, save.onionFrame ?? save.renderedFrame)');
    expect(flushBlock).toContain('input.setPreviewFrame(frame, save.onionFrame ?? save.renderedFrame)');
    expect(flushBlock).toContain('renderedFrame,');
    expect(flushBlock).toContain('backgroundMetadata: input.getBackgroundMetadata(),');
    expect(rotoSaveTransactionsSource()).toContain("...(input.onionFrame?.dataUrl ? { onionDataUrl: input.onionFrame.dataUrl } : {})");
  });

  it('persists Roto background metadata from standalone paper settings without creating cached cells', () => {
    const text = source();

    const metadataSync = readFileSync(fileURLToPath(new URL('./useRotoBackgroundMetadataSync.ts', import.meta.url)), 'utf8');
    const settings = readFileSync(fileURLToPath(new URL('./physicsPaintStudioSettings.ts', import.meta.url)), 'utf8');

    expect(settings).toContain('export function buildRotoBackgroundMetadata(settings: PhysicsPaintStudioSettings): PhysicPaintRotoBackgroundMetadata');
    expect(metadataSync).toContain('physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings))');
    expect(text).toContain('backgroundMetadata: input.getBackgroundMetadata(),');
    expect(text).toContain('useRotoBackgroundMetadataSync({ launchContext, workflowMode, settings });');
    expect(text).not.toContain('setFrame(launchContext.layerId, currentFrame, buildRotoBackgroundMetadata');
  });

  it('defaults onion skinning off with next-frame onion disabled, while preserving manual controls', () => {
    const text = source();

    expect(text).toContain('const DEFAULT_ONION_STATE: PhysicsPaintOnionState = { enabled: false, previous: true, next: false, count: 1, opacity: 50 }');
    expect(readFileSync(onionPreviewPath, 'utf8')).toContain('const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const');
    expect(text).toContain('useState<PhysicsPaintOnionState>(DEFAULT_ONION_STATE)');
    const onionProjection = readFileSync(onionPreviewPath, 'utf8');
    expect(onionProjection).toContain("frame.direction === 'previous' && input.onion.previous");
    expect(onionProjection).toContain("frame.direction === 'next' && input.onion.next");
    expect(text).toContain('style={{ opacity: getOnionFrameOpacity(frame.distance) }}');
  });

  it('uses saved transparent onion payloads for cached Roto key onion frames', () => {
    const text = source();
    const types = readFileSync(fileURLToPath(new URL('../../types/physicPaint.ts', import.meta.url)), 'utf8');
    const store = readFileSync(fileURLToPath(new URL('../../stores/physicPaintStore.ts', import.meta.url)), 'utf8');
    const flushBlock = rotoSaveControllerSource();
    const onionBlock = readFileSync(onionPreviewPath, 'utf8');

    expect(types).toContain('onionDataUrl?: string');
    expect(store).toContain('payload.onionDataUrl');
    expect(flushBlock).toContain('input.setPreviewFrame(frame, save.onionFrame ?? save.renderedFrame)');
    expect(rotoSaveTransactionsSource()).toContain("...(input.onionFrame?.dataUrl ? { onionDataUrl: input.onionFrame.dataUrl } : {})");
    expect(onionBlock).toContain('const addCandidate = (frame: RotoOnionFrame) =>');
    expect(onionBlock).toContain("if (frame.source && frame.source !== 'real-key') return;");
    expect(onionBlock).toContain('if (frame.backgroundOnly) return;');
    expect(onionBlock).toContain("onionKind: 'stroke-preview'");
    expect(onionBlock).toContain("frame.source === 'real-key' ? 'cached-composite' : 'stroke-preview'");
    expect(text).toContain('storeFrames: launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : []');
    expect(onionBlock).toContain('input.dirtyFrames?.has(frameNumber) || !candidates.has(frameNumber)');
  });

  it('D-18/D-19/D-20 resolves onion anchors from real source keys for custom dynamic spans', () => {
    const onionBlock = readFileSync(onionPreviewPath, 'utf8');

    // Source keys 0/1/2/6 with global 2 and custom 2 -> 6 = 4 display as real keys 0/3/6/11.
    // Generated display frames 7/8/9/10 can be current previews, but they must not become anchors.
    expect(onionBlock).toContain('const anchorFrame = getRotoOnionAnchorDisplayFrame(frame)');
    expect(onionBlock).toContain('candidates.set(anchorFrame');
    expect(onionBlock).toContain("if (frame.source && frame.source !== 'real-key') return;");
    expect(onionBlock).toContain("source: 'real-key'");
    expect(onionBlock).not.toContain('candidates.set(frame.appFrame');
    expect(onionBlock).toContain('fromSourceFrame');
    expect(onionBlock).toContain('toSourceFrame');
    expect(onionBlock).toContain('displayFrame');
  });

  it('renders onion frames above cached current-frame references inside the overlay', () => {
    const css = styles();
    const onionRuleStart = css.indexOf('.physics-paint-onion-frame {');
    const onionRule = css.slice(onionRuleStart, css.indexOf('}', onionRuleStart));
    const cachedRotoRuleStart = css.lastIndexOf('.physics-paint-cached-roto-reference {');
    const cachedRotoRule = css.slice(cachedRotoRuleStart, css.indexOf('}', cachedRotoRuleStart));

    expect(onionRule).toContain('z-index: 2;');
    expect(cachedRotoRule).toContain('z-index: 1;');
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
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).not.toContain('function getRealCachedRotoFrames(context: PhysicPaintLaunchContext | null)');
    expect(text).toContain('selectRealCachedRotoFrames');
    expect(text).not.toContain('function getSavedRotoMarkersFromLaunchContext(context: PhysicPaintLaunchContext | null)');
    expect(text).not.toContain('useState<PhysicsPaintWorkflowStripFrameMarker[]>(() => getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).not.toContain('useState<number[]>(() => getRealCachedRotoDisplayFrameNumbers(launchContext))');
    expect(text).not.toContain('setSavedRotoFrames(getSavedRotoMarkersFromLaunchContext(launchContext))');
    expect(text).not.toContain('setOccupiedRotoFrames(getRealCachedRotoDisplayFrameNumbers(launchContext))');
    expect(text).toContain('const rotoTimelineModel = useRotoTimelineModel');
    expect(text).toContain('const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value');
    expect(text).toContain('const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value');
    expect(workflowStripBlock).toContain('occupiedRotoFrames={timelineOccupiedRotoFrames}');
    expect(workflowStripBlock).toContain('savedRotoFrames={timelineSavedRotoFrames}');
    expect(workflowStripBlock).toContain('cachedRotoFrames={timelineCachedRotoFrames}');
  });

  it('keeps cached Roto playback scoped to session display frames including generated cache frames', () => {
    const text = source();
    const playbackBlock = text.slice(text.indexOf('function findCachedRotoPlaybackFrame'), text.indexOf('useEffect(() => {', text.indexOf('function findCachedRotoPlaybackFrame')));

    expect(playbackBlock).toContain('return findCachedRotoDisplayFrame(appFrame)');
    expect(playbackBlock).toContain('return rotoSession.playbackFrameNumbers.value.map((appFrame) => ({ appFrame, frame: findCachedRotoPlaybackFrame(appFrame) }))');
    expect(playbackBlock).toContain('RenderedFramePayload | null');
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

    expect(text).toContain("from './useRotoReferenceController'");
    expect(text).toContain('const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({');
    expect(controller).toContain('input.setReferenceUrl(null)');
    expect(controller).toContain('engine.setBgMode(input.getSettingsBackground())');
    expect(controller).toContain('engine.setPreviewBaseImageUrl(cachedFrame.dataUrl)');
    expect(controller).toContain('engine.clearPreviewBaseImage()');
    expect(controller).toContain('engine.resetBackground()');
    expect(controller).toContain('engine.clear()');
    expect(controller).not.toContain('setBackgroundImageUrl');
    expect(text).toContain('const resetRotoSessionForLaunch = useCallback');
    expect(text).toContain('resetRotoSessionForLaunch(hydratedContext, { preserveCloseAfterRotoSave })');
    expect(text).toContain('loadCachedRotoReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine)');
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

    const settings = readFileSync(fileURLToPath(new URL('./physicsPaintStudioSettings.ts', import.meta.url)), 'utf8');
    const lifecycle = readFileSync(fileURLToPath(new URL('./usePhysicsPaintEngineLifecycle.ts', import.meta.url)), 'utf8');

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
    expect(bridge).toContain('applyIncomingLaunchContext(storedContext)');
    expect(bridge).toContain('applyIncomingLaunchContext(event.payload)');
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
    expect(text).toContain('setLatestPlayFrames(frames)');
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
    expect(text).toContain('setCachedPlayPreviewUrl(null)');
    expect(text).toContain('setSavedPlayCacheDirty(true)');
    expect(text).toContain('markSelectedPlayCacheDirty');
  });

  it('passes launch gap limits into the fixed Play mode so frame 11 can clamp to one visible cell', () => {
    const text = source();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(sessionControllerSource()).toContain('function makeLoadedPlayLaunchContext');
    expect(sessionControllerSource()).toContain('delete next.maxPlayFrameCount');
    expect(sessionControllerSource()).toContain('delete next.maxPlayFrameCountReason');
    expect(sessionControllerSource()).toContain('makeLoadedPlayLaunchContext(current, frameCount, previewFrame)');
    expect(workflowStripBlock).toContain('maxPlayFrameCount={launchContext?.maxPlayFrameCount}');
    expect(workflowStripBlock).toContain('maxPlayFrameCountReason={launchContext?.maxPlayFrameCountReason}');
    expect(workflowStripBlock).toContain('onPlayLimit={playLimitToast.show}');
    expect(workflowStripBlock).toContain('startFrame={launchContext?.startFrame ?? 0}');
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

  it('delegates editable session persistence and debug proof export to the focused controller', () => {
    const text = source();
    const controller = sessionControllerSource();

    expect(text).toContain("import { usePhysicsPaintSessionController } from './usePhysicsPaintSessionController'");
    expect(text).toContain('const { saveEditableState, loadEditableState, exportDebugProof } = usePhysicsPaintSessionController');
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
    const text = source();
    const updateBlock = text.slice(text.indexOf('const updateSelectedPlayOptions = useCallback'), text.indexOf('const savePlay = useCallback'));

    expect(readFileSync(fileURLToPath(new URL('./physicsPaintStudioSettings.ts', import.meta.url)), 'utf8')).toContain('export function buildPlayRenderOptionsSnapshot');
    expect(bridgeSource()).toContain('playRenderOptions: structuredClone(containingRange.renderOptions)');
    expect(updateBlock).toContain("kind: 'update-play-render-options'");
    expect(updateBlock).toContain('buildPlayRenderOptionsSnapshot(settings, playWiggle)');
    expect(playLifecycleTransactionsSource()).toContain('JSON.stringify(input.context.playRenderOptions ?? null) !== JSON.stringify(input.renderOptions)');
    expect(updateBlock).toContain('setCachedPlayPreviewUrl(null)');
    expect(updateBlock).toContain('setSavedPlayCacheDirty(true)');
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
    const savePlayBlock = text.slice(text.indexOf('const savePlay = useCallback'), text.indexOf('const savePendingRotoFrames'));

    expect(savePlayBlock).toContain('const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame)');
    expect(playPreviewControllerSource()).toContain('appFrame: options.startFrame + frameIndex');
    expect(savePlayBlock).toContain('startFrame: playStartFrame');
    expect(savePlayBlock).toContain('latestPlayFramesRef.current = frames');
    expect(savePlayBlock).toContain('setLatestPlayFrames(frames)');
    expect(savePlayBlock).toContain('setCachedPlayPreviewUrl(frames[0]?.dataUrl ?? null)');
    expect(savePlayBlock).toContain('setSavedPlayCacheDirty(false)');
    expect(savePlayBlock).toContain('setLocalPlayPreviewFrame(0)');
    expect(savePlayBlock).toContain('playScriptId: launchContext.selectedPlayScriptId');
    expect(savePlayBlock).toContain('playMotion: playWiggle');
    expect(savePlayBlock).toContain('renderOptions,');
    expect(savePlayBlock).toContain('renderOptions,');
    expect(playLifecycleTransactionsSource()).toContain('playRenderOptions: input.renderOptions');
    expect(savePlayBlock).toContain('annotatePlayState(engine.save())');
    expect(savePlayBlock).toContain('(engine as PreviewBackgroundEngine).resetBackground()');
    expect(savePlayBlock).not.toContain('strokeStyleOverride');
    expect(text).not.toContain('function buildPlayStrokeStyleOverride');
  });

  it('36.12 UAT Test 8 wires visible Roto interpolation count through store-owned regeneration and status copy', () => {
    const text = source();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));
    const updateBlock = text.slice(text.indexOf('const updateRotoInterpolationSettings = useCallback'), text.indexOf('const goToFirstFrame = useCallback'));
    const cacheTransactions = rotoCacheTransactionsSource();

    expect(text).toContain('const updateRotoInterpolationSettings = useCallback');
    expect(updateBlock).toContain('rotoTimelineActions.updateInterpolationSettings(currentFrame, patch)');
    expect(updateBlock).not.toContain('mode: patch.mode ?? currentSettings.mode');
    expect(updateBlock).toContain('rotoTimelineActions.updateInterpolationSettings(currentFrame, patch)');
    expect(updateBlock).toContain("kind: 'update-roto-interpolation-settings'");
    expect(updateBlock).toContain('settings: transaction.settings');
    expect(updateBlock).toContain('void sendPhysicPaintApplyPayload(payload, bridgeMode)');
    const launchHydration = rotoLaunchHydrationSource();
    expect(text).not.toContain('function hydrateLaunchContextRotoInterpolation');
    expect(text).toContain('const hydratedContext = hydrateRotoLaunchContext(context, physicPaintStore)');
    expect(launchHydration).toContain('export function seedRotoLaunchRealKeys');
    expect(launchHydration).toContain('const sourceFrame = frame.sourceFrame ?? frame.appFrame;');
    expect(launchHydration).toContain('store.upsertRealRotoKeyFrame(context.layerId, sourceFrame, frame, frame.backgroundOnly === true)');
    expect(updateBlock).toContain('seedRotoLaunchRealKeys(launchContext, physicPaintStore)');
    expect(updateBlock).toContain('const cacheRefresh = refreshRotoInterpolationCache(');
    expect(updateBlock).toContain('transaction.settings.enabled');
    expect(cacheTransactions).toContain('mergeRotoCacheFramesPreservingLaunchRealKeys(launchFrames, storeFrames)');
    expect(cacheTransactions).toContain('.map(normalizeCachedRotoRealKeySourceFrame)');
    expect(cacheTransactions).toContain('const frames = storeFrames.length > 0');
    expect(cacheTransactions).toContain("storeFrames.filter((frame) => enabled || frame.source === 'real-key')");
    expect(cacheTransactions).toContain('realDisplayFrames: realKeys.map((frame) => frame.displayFrame ?? frame.appFrame)');
    expect(updateBlock).toContain('rotoEditBuffer.setEditableFrameList((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)))');
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
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    expect(resultBlock).toContain('if (handleRotoApplyResult(transition)) return;');
    expect(resultBlock).not.toContain("detail.kind === 'update-roto-interpolation-settings'");
    expect(rotoApplyResultControllerSource()).toContain("setApplyMessage((message) => message || 'Generated in-between settings synced.');");
    expect(text).toContain('rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId)');
    expect(workflowStripBlock).toContain('onRotoInterpolationEnabledChange={(enabled) => updateRotoInterpolationSettings({ enabled })}');
    expect(workflowStripBlock).toContain('onRotoInterpolationCountChange={(inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })}');
    expect(workflowStripBlock).not.toContain('onRotoInterpolationModeChange=');
    expect(workflowStripBlock).not.toContain('onRotoInterpolationMotionChange=');
  });

  it('delegates cached Roto playback state and timer ownership to the focused hook', () => {
    const text = source();
    const cachedRotoBlock = text.slice(text.indexOf('function findCachedRotoPlaybackFrame'), text.indexOf('const playPreview = useCallback'));
    const canvasStackBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('<CanvasMountProbe'));
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).toContain("from './useRotoCachedPlayback'");
    expect(text).toContain('const rotoCachedPlayback = useRotoCachedPlayback({');
    expect(text).toContain('resetRotoCachedPlaybackRef.current = rotoCachedPlayback.resetForLaunch');
    expect(text).not.toContain('rotoCachedPlaybackTimerRef');
    expect(text).not.toContain('const startRotoCachedPlayback = useCallback');
    expect(text).not.toContain('const stopRotoCachedPlayback = useCallback');
    const referenceController = rotoReferenceControllerSource();
    expect(text).toContain('const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({');
    expect(referenceController).toContain('export function findCachedRotoDisplayFrame');
    expect(referenceController).toContain('export function findCachedRotoReferenceFrame');
    expect(referenceController).toContain("frame.source === 'generated-interpolation'");
    expect(referenceController).toContain('input.previewFrames.get(appFrame)');
    expect(referenceController).toContain('input.confirmedFrames.values()');
    expect(cachedRotoBlock).toContain('Array<{ appFrame: number; frame: RenderedFramePayload | null }>');
    expect(cachedRotoBlock).toContain('return rotoSession.playbackFrameNumbers.value.map((appFrame) => ({ appFrame, frame: findCachedRotoPlaybackFrame(appFrame) }))');
    expect(cachedRotoBlock).not.toContain('return getRealCachedRotoDisplayFrameNumbers(launchContext)');
    expect(cachedRotoBlock).toContain('onFrame: (frameIndex, appFrame) => {');
    expect(cachedRotoBlock).toContain('setLaunchContext((current) => current ? { ...current, startFrame: appFrame } : current)');
    expect(canvasStackBlock).toContain('cachedRotoPlaybackUrl={rotoCachedPlayback.frame?.dataUrl ?? null}');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackAvailable={rotoCachedPlaybackAvailable}');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackStatus={rotoCachedPlayback.status}');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackLoop={rotoCachedPlayback.loop}');
    expect(workflowStripBlock).toContain('rotoCachedPlaybackFps={rotoCachedPlayback.fps}');
    expect(workflowStripBlock).toContain('isRotoCachedPlaybackActive={rotoCachedPlayback.isActive}');
    expect(workflowStripBlock).toContain('onToggleRotoPlayback={rotoCachedPlayback.toggle}');
    expect(workflowStripBlock).toContain('onRotoPlaybackLoopChange={rotoCachedPlayback.setLoop}');
    expect(workflowStripBlock).toContain('onRotoPlaybackFpsChange={rotoCachedPlayback.updateFps}');
  });

  it('stops cached Roto playback through the hook for edit intent, navigation, and preview cleanup', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const requestNavigationBlock = text.slice(text.indexOf('const requestRotoFrameNavigation = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const canvasStackBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('<CanvasMountProbe'));

    expect(readFileSync(studioSelectorsPath, 'utf8')).toContain("input.applyStatus === 'applying' || (input.isPlaying && !input.rotoPlaybackActive)");
    expect(navigateBlock).toContain('rotoCachedPlayback.stop()');
    expect(requestNavigationBlock).toContain('const result = rotoSession.requestFrame(targetFrame)');
    expect(requestNavigationBlock).toContain('executeRotoSessionEffects(result.effects)');
    expect(text).toContain('const beginRotoFrameEdit = useCallback');
    expect(text).toContain("if (event.key === ' ')");
    expect(text).toContain('rotoCachedPlayback.toggle()');
    expect(canvasStackBlock).toContain('onInputIntent={workflowMode === \'play\' ? beginPlayFrameEdit : beginRotoFrameEdit}');
    expect(text).toContain('rotoCachedPlayback.stop();');
  });
});

describe('PhysicsPaintStudio Roto cache-first autosave contract', () => {
  it('loads cached-only Roto frames as repaintable non-exported references through the focused controller', () => {
    const text = source();
    const controller = rotoReferenceControllerSource();

    expect(text).toContain('const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({');
    expect(controller).toContain("frame.source === 'generated-interpolation'");
    expect(controller).toContain("frame.source === 'real-key'");
    expect(controller).toContain('input.getRotoFrame(appFrame)');
    expect(controller).toContain('input.getFrame(appFrame)');
    expect(controller).toContain('input.previewFrames.get(appFrame)');
    expect(controller).toContain('input.confirmedFrames.values()');
    expect(controller).not.toContain('markCachedBaseLoaded');
    expect(controller).not.toContain('setBackgroundImageUrl');
    expect(controller).toContain('engine.resetBackground()');
    expect(text).toContain('cachedRotoReferenceUrl={cachedRotoReferenceUrl}');
    expect(text).toContain('class="physics-paint-cached-roto-reference"');
  });

  it('clears stale cached Roto reference overlays before navigation loads the destination frame', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));

    expect(navigateBlock).toContain('clearCachedRotoReferenceUrl()');
    expect(navigateBlock.indexOf('clearCachedRotoReferenceUrl()')).toBeLessThan(navigateBlock.indexOf('loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine)'));
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
    const css = styles();
    const cachedRotoRuleStart = css.lastIndexOf('.physics-paint-cached-roto-reference {');
    const cssRule = css.slice(cachedRotoRuleStart, css.indexOf('}', cachedRotoRuleStart));
    const flushBlock = rotoSaveControllerSource();

    expect(cssRule).not.toContain('opacity: 0.78');
    expect(cssRule).not.toMatch(/opacity:\s*0\.[0-9]+/);
    expect(cssRule).toContain('outline:');
    expect(flushBlock.indexOf('if (!capturedFrame) input.resetBackground(engine)')).toBeLessThan(flushBlock.indexOf('input.renderFrame({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame })'));
    expect(flushBlock.indexOf('setCachedRotoReferenceUrl(null)')).toBeLessThan(flushBlock.indexOf('input.renderFrame({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame })'));
  });

  it('keeps beforeunload snapshot-only while explicit Save current remains the cache write path', () => {
    const text = source();
    const saveBlock = rotoSaveControllerSource();
    const beforeUnloadBlock = text.slice(text.indexOf('const handleBeforeUnload ='), text.indexOf('window.addEventListener(\'beforeunload\', handleBeforeUnload)'));

    expect(text).toContain('const saveRotoFrame = useCallback');
    expect(saveBlock).toContain('input.snapshotCurrentFrame()');
    expect(saveBlock).toContain('input.dirtyFramesRef.current.add(currentFrame)');
    expect(saveBlock).toContain('rotoInterpolationSettings: saveTransaction.interpolationSettings');
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
    const closeLifecycle = rotoCloseLifecycleSource();
    const promptBlock = text.slice(text.indexOf('physics-paint-roto-close-confirmation'), text.indexOf('{shortcutsVisible'));

    expect(closeLifecycle).toContain("export type RotoClosePromptState = 'idle' | 'prompt' | 'saving' | 'error'");
    expect(text).toContain('const closeGuardBypassRef = useRef(false)');
    expect(closeLifecycle).toContain('input.snapshotCurrentRotoFrame()');
    expect(closeLifecycle).toContain("input.workflowMode === 'roto' && input.dirtyFramesRef.current.has(input.currentFrame)");
    expect(closeLifecycle).toContain('event.preventDefault()');
    expect(closeLifecycle).toContain("setRotoClosePromptState('prompt')");
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
    const saveCloseBlock = rotoCloseLifecycleSource().slice(rotoCloseLifecycleSource().indexOf('const saveAndCloseRotoFrame = useCallback'), rotoCloseLifecycleSource().indexOf('useEffect(() => {', rotoCloseLifecycleSource().indexOf('const saveAndCloseRotoFrame = useCallback')));
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    expect(text).toContain("import { useRotoApplyLifecycle } from './useRotoApplyLifecycle'");
    expect(rotoApplyLifecycleSource()).toContain('const closeAfterApplyOperationIdRef = useRef<string | null>(null)');
    expect(rotoApplyLifecycleSource()).toContain('const closeAfterRotoSaveRequestedRef = useRef(false)');
    expect(text).not.toContain('closeAfterRotoSaveReady');
    expect(saveCloseBlock).toContain('if (input.closeAfterRotoSaveRequestedRef.current) return');
    expect(saveCloseBlock).toContain('input.closeAfterRotoSaveRequestedRef.current = true');
    expect(saveCloseBlock).toContain('closeGuardBypassRef.current = true');
    expect(saveCloseBlock).toContain("setRotoClosePromptState('idle')");
    expect(saveCloseBlock).toContain('setRotoClosePromptMessage(null)');
    expect(saveCloseBlock).not.toContain("setRotoClosePromptState('saving')");
    expect(saveCloseBlock).not.toContain("setRotoClosePromptMessage('Saving current frame…')");
    expect(saveCloseBlock).toContain('const payload = await input.saveCurrentRotoFrame({');
    expect(saveCloseBlock).toContain('onPayload: (payload) => {');
    expect(saveCloseBlock).toContain('closeAfterApplyOperationIdRef.current = payload.operationId');
    expect(saveCloseBlock).toContain("if (payload.kind === 'apply-canvas') payload.closeWindowAfterApply = true");
    expect(saveCloseBlock.indexOf('closeAfterApplyOperationIdRef.current = payload.operationId')).toBeLessThan(saveCloseBlock.indexOf('if (!payload?.operationId)'));
    expect(saveCloseBlock).not.toContain('closePhysicsPaintWindow()');
    expect(rotoApplyTransactionsSource()).toContain('snapshot.closeAfterRotoSaveRequested && pendingApply.operationId === detail.operationId');
    expect(resultBlock).toContain('if (shouldCloseAfterSave)');
    expect(resultBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(rotoApplyResultControllerSource()).toContain('input.closeGuardBypassRef.current = true');
    expect(rotoApplyResultControllerSource()).toContain('void input.closeWindow()');
  });

  it('recovers dirty close prompt state after send errors, failed apply results, timeouts, and cleanup', () => {
    const text = source();
    const closeLifecycle = rotoCloseLifecycleSource();
    const saveCloseBlock = closeLifecycle.slice(closeLifecycle.indexOf('const saveAndCloseRotoFrame = useCallback'), closeLifecycle.indexOf('useEffect(() => {', closeLifecycle.indexOf('const saveAndCloseRotoFrame = useCallback')));
    const lifecycle = rotoApplyLifecycleSource();
    const timeoutBlock = lifecycle.slice(lifecycle.indexOf('const startApplyTimeout = useCallback'), lifecycle.indexOf('useEffect(() => clearApplyTimeout'));
    const closeListenerBlock = closeLifecycle.slice(closeLifecycle.indexOf('appWindow.onCloseRequested'), closeLifecycle.indexOf('return {', closeLifecycle.indexOf('appWindow.onCloseRequested')));
    const cleanupBlock = text.slice(text.indexOf('clearExternalState: () => {'), text.indexOf('const currentFrame = launchContext?.startFrame'));

    expect(closeListenerBlock).toContain('input.closeGuardBypassRef.current || input.closeAfterRotoSaveRequestedRef.current');
    expect(saveCloseBlock).toContain("setRotoClosePromptState('error')");
    expect(saveCloseBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(saveCloseBlock).toContain('input.closeAfterRotoSaveRequestedRef.current = false');
    expect(saveCloseBlock).toContain('closeGuardBypassRef.current = false');
    expect(rotoApplyResultControllerSource()).toContain("input.setClosePromptState('error')");
    expect(rotoApplyResultControllerSource()).toContain('input.closeAfterApplyOperationIdRef.current = null');
    expect(rotoApplyResultControllerSource()).toContain('input.closeAfterRotoSaveRequestedRef.current = false');
    expect(timeoutBlock).toContain('input.onTimeout(transition)');
    expect(text).toContain("if (transition.closeFailed) {");
    expect(text).toContain("setRotoClosePromptState('error')");
    expect(text).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(cleanupBlock).toContain('closeAfterApplyOperationIdRef.current = null');
    expect(cleanupBlock).toContain('closeAfterRotoSaveRequestedRef.current = false');
    expect(cleanupBlock).toContain('closeGuardBypassRef.current = false');
  });

  it('preserves dirty close-save continuation across the apply-result launch-context refresh', () => {
    const text = source();
    const applyIncomingBlock = text.slice(text.indexOf('const applyIncomingLaunchContext = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const applyIncomingLaunchContext = useCallback')));
    const resetBlock = text.slice(text.indexOf('const resetRotoSessionForLaunch = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const resetRotoSessionForLaunch = useCallback')));

    expect(applyIncomingBlock).toContain('const preserveCloseAfterRotoSave = closeAfterRotoSaveRequestedRef.current');
    expect(applyIncomingBlock).toContain('resetRotoSessionForLaunch(hydratedContext, { preserveCloseAfterRotoSave })');
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
    const flushBlock = rotoSaveControllerSource();
    const saveBlock = rotoSaveControllerSource();

    expect(saveBlock).toContain('flushRotoFrame(currentFrame, {');
    expect(saveBlock).not.toContain('savePendingRotoFrames()');
    expect(saveBlock).not.toContain('savePlay()');
    expect(rotoSaveTransactionsSource()).toContain("kind: 'apply-canvas'");
    expect(flushBlock).toContain('renderedFrame,');
    expect(flushBlock).toContain('await input.sendApplyPayload(payload, bridgeMode)');
    expect(saveBlock).not.toContain('buildRotoOutputFrame');
    expect(saveBlock).not.toContain('getRotoCachedPlaybackFrames');
  });

  it('keeps saved Roto PNGs in the standalone cache for navigation reference after Save current', () => {
    const text = source();
    const cacheTransactions = rotoCacheTransactionsSource();
    const upsertCallbackBlock = text.slice(text.indexOf('const upsertCachedRotoFrameInLaunchContext = useCallback'), text.indexOf('const removeCachedRotoFrameFromLaunchContext = useCallback'));
    const flushBlock = rotoSaveControllerSource();

    expect(text).toContain('const upsertCachedRotoFrameInLaunchContext = useCallback');
    expect(text).toContain("from './rotoCacheTransactions'");
    expect(text).not.toContain('function upsertCachedRotoCacheFrame');
    expect(cacheTransactions).toContain("source: 'real-key'");
    expect(cacheTransactions).toContain('onionDataUrl: onionFrame.dataUrl');
    expect(upsertCallbackBlock).toContain('const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame');
    expect(upsertCallbackBlock).toContain('confirmedCachedRotoFramesRef.current.set(sourceFrame, normalizedRenderedFrame)');
    expect(upsertCallbackBlock).toContain('const refreshedRotoFrames = settings.enabled && storeFrames.length > 0 ? storeFrames : manualFrames');
    expect(upsertCallbackBlock).toContain('const nextDisplayFrame = refreshedRotoFrames.find');
    expect(upsertCallbackBlock).not.toContain('setOccupiedRotoFrames');
    expect(upsertCallbackBlock).not.toContain('setSavedRotoFrames');
    expect(upsertCallbackBlock).toContain('startFrame: nextDisplayFrame');
    expect(upsertCallbackBlock).toContain('cachedRotoFrames: refreshedRotoFrames');
    expect(flushBlock).toContain('input.upsertCachedFrame(save, options.rotoInterpolationSettings)');
    expect(flushBlock).not.toContain('savePendingRotoFrames()');
  });

  it('D-02/D-03/36.11-ALPHA-ONLY-MERGE merges cached real-key base with live transparent output only on dirty cached-key repaint save', () => {
    const text = source();
    const importsBlock = text.slice(0, text.indexOf('const CANVAS_MOUNT_ERROR'));
    const controller = rotoReferenceControllerSource();
    const dirtyBlock = text.slice(text.indexOf('const markCurrentRotoFrameDirty = useCallback'), text.indexOf('const beginRotoFrameEdit = useCallback'));
    const flushBlock = rotoSaveControllerSource();

    expect(importsBlock).toContain("import { mergeCachedRotoAlphaFrame } from './physicsPaintRotoAlphaMerge'");
    expect(text).toContain('const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({');
    expect(controller).toContain('input.setRepaintBaseFrame((current) => current?.appFrame === appFrame ? current : null)');
    expect(controller.indexOf('input.dirtyFrames.has(appFrame)')).toBeLessThan(controller.indexOf('const cachedFrame = input.getReferenceFrame(appFrame)'));
    expect(dirtyBlock).not.toContain('setCachedRotoReferenceUrl(null)');
    expect(dirtyBlock).toContain('clearCachedRotoReferenceUrl()');
    expect(flushBlock).toContain('const cachedRepaintBase = input.getCachedRepaintFrame(frame)');
    expect(flushBlock).toContain('}, [input])');
    expect(text).toContain('const liveAlphaCanvas = exportTransparentStrokeCanvas(saveEngine)');
    expect(text).toContain('mergeCachedRotoAlphaFrame(cachedRepaintBase, liveAlphaCanvas, sourceFrame, { width: canvasWidth, height: canvasHeight })');
    expect(text).toContain('const renderedFrame = cachedRepaintBase\n        ? await mergeCachedRotoAlphaFrame');
    expect(flushBlock).toContain('input.setPreviewFrame(frame, save.onionFrame ?? save.renderedFrame)');
    expect(flushBlock).toContain('renderedFrame,');
    expect(rotoSaveTransactionsSource()).toContain("kind: 'apply-canvas'");
    expect(flushBlock).toContain('input.pendingCachedMergeFrameRef.current = { frame, ...save }');
    expect(flushBlock).toContain('else input.upsertCachedFrame(save, options.rotoInterpolationSettings)');
    expect(flushBlock).not.toContain('engine.load(cachedRepaintBase');
    expect(flushBlock).not.toContain('reconstructCachedRoto');
  });

  it('D-01 keeps cached repaint base full strength and semantically separate from onion/playback/reference visual treatment', () => {
    const text = source();
    const canvasStackBlock = text.slice(text.indexOf('function PhysicsPaintCanvasStack'), text.indexOf('function makeInitialSettings'));

    expect(text).not.toContain('cachedRotoRepaintBaseUrl?: string | null');
    expect(text).not.toContain('class="physics-paint-cached-roto-repaint-base"');
    expect(text).not.toContain('cachedRotoRepaintBaseUrl={cachedRotoRepaintBaseFrame?.dataUrl ?? null}');
    expect(text).not.toContain('cached-roto-repaint');
    expect(canvasStackBlock).not.toContain('class="physics-paint-cached-roto-repaint-base"');
    expect(canvasStackBlock).not.toContain('physics-paint-onion-frame cachedRotoRepaintBaseUrl');
    expect(canvasStackBlock).not.toContain('physics-paint-cached-play-preview cachedRotoRepaintBaseUrl');
    expect(canvasStackBlock).not.toContain('physics-paint-cached-roto-reference cachedRotoRepaintBaseUrl');
    expect(rotoReferenceControllerSource()).toContain('engine.setPreviewBaseImageUrl(cachedFrame.dataUrl)');
    expect(rotoReferenceControllerSource()).toContain('engine.clearPreviewBaseImage()');
  });

  it('D-02 keeps the cached repaint base outside editable stroke/script state restoration', () => {
    const text = source();
    const controller = rotoReferenceControllerSource();
    const snapshotBlock = text.slice(text.indexOf('const snapshotCurrentRotoFrame = useCallback'), text.indexOf('const startRotoCachedPlayback'));

    expect(controller).toContain('input.setRepaintBaseFrame(cachedFrame)');
    expect(controller).toContain('input.setRepaintBaseFrame((current) => current?.appFrame === appFrame ? current : null)');
    expect(controller).toContain('engine.setPreviewBaseImageUrl(cachedFrame.dataUrl)');
    expect(controller).toContain('engine.clear()');
    expect(controller).not.toContain('engine.load(cachedFrame');
    expect(controller).not.toContain('editableState');
    expect(controller).not.toContain('strokes');
    expect(snapshotBlock).toContain('cachedRotoRepaintBaseFrame?.appFrame === appFrame');
    expect(snapshotBlock).not.toContain('cachedRotoRepaintBaseFrame.strokes');
    expect(snapshotBlock).not.toContain('rotoFrameStatesRef.current.set(appFrame, cachedRotoRepaintBaseFrame');
  });

  it('D-15/D-16 preserves cached repaint base and dirty live edits on merge failure while surfacing compact retry feedback', () => {
    const flushBlock = rotoSaveControllerSource();

    expect(flushBlock).toContain("input.setApplyMessage(save.cachedRepaint ? `Merged new paint into frame ${frame}.` : 'Saving current frame…')");
    expect(flushBlock).toContain('const message = cachedRepaintBase');
    expect(flushBlock).toContain('input.setCachedReferenceUrl(null)');
    expect(flushBlock).toContain('input.restoreCachedRepaintFrame(cachedRepaintBase)');
    expect(flushBlock).toContain('input.dirtyFramesRef.current.add(frame)');
    expect(flushBlock).not.toContain('engine.clear()');
  });

  it('36.11 clears live repaint overlay only after the merged cached frame is accepted', () => {
    const controller = rotoApplyResultControllerSource();
    expect(controller).toContain('const mergedFrame = input.pendingCachedMergeFrameRef.current?.frame === frame ? input.pendingCachedMergeFrameRef.current : null');
    expect(controller).toContain('input.upsertCachedFrame(mergedFrame)');
    expect(controller).toContain('input.setCachedReferenceUrl(null)');
    expect(controller).toContain('input.setCachedRepaintBaseFrame(mergedFrame.renderedFrame)');
    expect(controller).toContain('input.frameStatesRef.current.delete(frame)');
    expect(controller).toContain('input.liveOverlayActionCountsRef.current.delete(frame)');
    expect(controller).toContain('input.removeEditableFrame(frame)');
    expect(controller).toContain('engine.setBgMode(input.getBackgroundMode())');
    expect(controller).toContain('engine.clear()');
    expect(controller).toContain('input.restorePreviewBase(engine, mergedFrame.renderedFrame.dataUrl)');
  });

  it('36.11 keeps accepted cached repaint saves in a confirmed in-session source for timeline navigation', () => {
    const text = source();
    const resetBlock = text.slice(text.indexOf('const resetRotoSessionForLaunch = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const resetRotoSessionForLaunch = useCallback')));
    const findBlock = rotoReferenceControllerSource();
    const upsertCallbackBlock = text.slice(text.indexOf('const upsertCachedRotoFrameInLaunchContext = useCallback'), text.indexOf('const markCurrentRotoFrameDirty = useCallback'));
    const snapshotBlock = text.slice(text.indexOf('const snapshotCurrentRotoFrame = useCallback'), text.indexOf('const startRotoCachedPlayback'));

    expect(text).toContain('const confirmedCachedRotoFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map())');
    expect(resetBlock).toContain('confirmedCachedRotoFramesRef.current = new Map(selectRealCachedRotoFrames(context.cachedRotoFrames).map((frame) => [frame.appFrame, frame]))');
    expect(findBlock.indexOf('input.previewFrames.get(appFrame)')).toBeLessThan(findBlock.indexOf('input.confirmedFrames.values()'));
    expect(findBlock.indexOf("frame.source === 'real-key'")).toBeLessThan(findBlock.indexOf('input.confirmedFrames.values()'));
    expect(upsertCallbackBlock).toContain('confirmedCachedRotoFramesRef.current.set(sourceFrame, normalizedRenderedFrame)');
    expect(text).toContain('confirmedCachedRotoFramesRef.current.delete(appFrame)');
    expect(snapshotBlock).toContain('rotoEditBuffer.snapshotFrame({');
    expect(snapshotBlock).not.toContain('confirmedCachedRotoFramesRef.current.delete(appFrame)');
  });

  it('36.11 D-10/D-13 preserves a clean cached-base Save current before delete/apply branches and reports compact no-new-paint feedback', () => {
    const saveBlock = rotoSaveControllerSource();

    expect(saveBlock).toContain('cachedRepaint: Boolean(input.getCachedRepaintFrame(currentFrame))');
    expect(saveBlock).toContain('cachedRepaint: Boolean(input.getCachedRepaintFrame(currentFrame))');
    expect(rotoSaveTransactionsSource()).toContain('No new paint to save for frame ${input.currentFrame}.');
    expect(saveBlock.indexOf('No new paint to save')).toBeLessThan(saveBlock.indexOf('flushRotoFrame(currentFrame'));
    expect(saveBlock).not.toContain("kind: 'delete-roto-frame'");
    expect(saveBlock).not.toContain('mergeCachedRotoAlphaFrame');
  });

  it('36.11 D-14 emits cached-base-open feedback through existing status/apply-message surface without new UI surfaces', () => {
    const text = source();
    const controller = rotoReferenceControllerSource();

    expect(controller).toContain('input.setApplyMessage(`Cached key base loaded — visible and non-editable. Add paint to update frame ${appFrame}.`)');
    expect(controller).toContain('input.setRepaintBaseFrame(cachedFrame)');
    expect(text).not.toContain('cached-base-modal');
    expect(text).not.toContain('cached-base-toast');
    expect(text).not.toContain('CachedBaseFeedback');
    expect(text).not.toContain('physics-paint-cached-base-feedback');
  });

  it('36.11 D-06/D-12 protects cached-base Clear as live-overlay-only without removing saved real-key/cache state', () => {
    const text = source();
    const clearBlock = text.slice(text.indexOf('const clearActiveSource = useCallback'), text.indexOf('const dryPaint = useCallback'));

    expect(clearBlock).toContain('if (cachedRotoRepaintBaseFrame?.appFrame === currentFrame) {');
    expect(clearBlock).toContain('rotoSession.markLiveOverlayEmpty(currentFrame)');
    expect(clearBlock).toContain('setApplyMessage(`Cleared live repaint strokes for frame ${currentFrame}; cached base preserved.`)');
    expect(clearBlock).toContain('return;');
    const cachedBaseBranch = clearBlock.slice(clearBlock.indexOf('if (cachedRotoRepaintBaseFrame?.appFrame === currentFrame)'), clearBlock.indexOf('rotoFrameStatesRef.current.delete(currentFrame)'));
    expect(cachedBaseBranch).not.toContain('removeEditableRotoFrame(currentFrame)');
    expect(cachedBaseBranch).not.toContain('setSavedRotoFrames((frames) => frames.filter');
    expect(cachedBaseBranch).not.toContain('setOccupiedRotoFrames((frames) => frames.filter');
    expect(cachedBaseBranch).not.toContain('removeCachedRotoFrameFromLaunchContext');
  });

  it('36.11 D-07 keeps Undo/Redo live-overlay-only and never loads cached-base pixels into editable history', () => {
    const text = source();
    const undoBlock = text.slice(text.indexOf('const undo = useCallback'), text.indexOf('const persistRotoBackgroundMetadata = useCallback'));
    const dirtyBlock = text.slice(text.indexOf('const markCurrentRotoFrameDirty = useCallback'), text.indexOf('const beginRotoFrameEdit = useCallback'));

    expect(text).toContain('liveOverlayActionCounts: new Map()');
    expect(undoBlock).toContain('engine?.undo()');
    expect(undoBlock).toContain('if (workflowMode === \'roto\' && cachedRotoRepaintBaseFrame?.appFrame === currentFrame)');
    expect(undoBlock).toContain('rotoSession.markLiveOverlayEmpty(currentFrame)');
    expect(dirtyBlock).toContain('rotoEditBuffer.markDirty(appFrame)');
    expect(text).not.toContain('engine.load(cachedRotoRepaintBaseFrame');
    expect(text).not.toContain('rotoFrameStatesRef.current.set(currentFrame, cachedRotoRepaintBaseFrame');
  });

  it('persists paper/background-only Roto frames without marking them editable-session pink', () => {
    const text = source();
    const predicateBlock = text.slice(text.indexOf('function shouldPersistRotoFrame'), text.indexOf('const WORKING_PIXEL_LIMIT'));
    const flushBlock = rotoSaveControllerSource();

    expect(predicateBlock).toContain("state.strokes.length > 0 || state.settings.bgMode !== 'transparent'");
    expect(predicateBlock).toContain("state.strokes.length === 0 && state.settings.bgMode !== 'transparent'");
    expect(flushBlock).toContain('if (save.backgroundOnly) input.removeEditableFrame(frame)');
    expect(flushBlock).toContain('if (save.backgroundOnly) input.removeEditableFrame(frame)');
    expect(flushBlock).toContain('input.removeEditableFrame(frame)');
    expect(flushBlock).toContain('else input.addEditableFrame(frame)');
    expect(flushBlock).toContain('input.addEditableFrame(frame)');
    expect(rotoSaveTransactionsSource()).toContain('...(input.backgroundOnly ? { backgroundOnly: true } : {})');
  });

  it('passes editable real-key Roto frames separately from occupied/background-only frames', () => {
    const text = source();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));
    const snapshotBlock = text.slice(text.indexOf('const snapshotCurrentRotoFrame = useCallback'), text.indexOf('const toggleRotoCachedPlayback'));

    expect(text).toContain('const editableRotoFrames = rotoEditBuffer.editableFrames');
    expect(rotoEditBufferTransactionsSource()).toContain('export function hasEditableRotoContent');
    expect(snapshotBlock).toContain('const hasCachedReference = Boolean(cachedRotoReferenceUrl || cachedRotoRepaintBaseFrame?.appFrame === appFrame)');
    expect(snapshotBlock).toContain('rotoEditBuffer.snapshotFrame({');
    expect(rotoEditBufferTransactionsSource()).toContain('editable: hasEditableRotoContent(input.state)');
    expect(text).toContain('const rotoTimelineModel = useRotoTimelineModel');
    expect(workflowStripBlock).toContain('occupiedRotoFrames={timelineOccupiedRotoFrames}');
    expect(workflowStripBlock).toContain('savedRotoFrames={timelineSavedRotoFrames}');
    expect(workflowStripBlock).toContain('editableRotoFrames={editableRotoFrames}');
    expect(workflowStripBlock).not.toContain('editableRotoFrames={occupiedRotoFrames}');
  });

  it('tracks dirty Roto frames without autosaving before synced navigation', () => {
    const text = source();
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));

    expect(text).toContain('dirtyFrames: new Set()');
    expect(text).toContain('const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null)');
    expect(text).toContain('const flushRotoFrame = useCallback(async (frame: number');
    expect(text).toContain('rotoEditBuffer.markDirty(appFrame)');
    expect(navigateBlock).toContain('snapshotCurrentRotoFrame()');
    expect(navigateBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(navigateBlock).not.toContain('await flushRotoFrame(previousFrame');
    expect(text).not.toContain('onPointerMoveCapture={');
  });

  it('routes Phase 36.6 save-on-leave Roto navigation through one leave-boundary coordinator (D-01, D-02, D-03, D-05)', () => {
    const text = source();
    const coordinatorBlock = text.slice(text.indexOf('const requestRotoFrameNavigation = useCallback'), text.indexOf('const previewLocalPlayFrame = useCallback'));
    const navigateBlock = text.slice(text.indexOf('const navigateToSyncedFrame = useCallback'), text.indexOf('const requestRotoFrameNavigation = useCallback'));
    const keyboardBlock = text.slice(text.indexOf('const handlePhysicsPaintKeyDown = useCallback'), text.indexOf('const onionPreviewFrames = projectRotoOnionPreviewFrames'));
    const frameNavBlock = readFileSync(rotoNavigationActionsPath, 'utf8');
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).toContain('const requestRotoFrameNavigation = useCallback');
    expect(coordinatorBlock).toContain('if (!Number.isInteger(targetFrame) || targetFrame < 0) return false');
    expect(coordinatorBlock).toContain('snapshotCurrentRotoFrame()');
    expect(coordinatorBlock).toContain('const result = rotoSession.requestFrame(targetFrame)');
    expect(coordinatorBlock).toContain("result.effects.some((effect) => effect.type === 'navigate')");
    expect(coordinatorBlock).toContain('executeRotoSessionEffects(result.effects)');
    expect(coordinatorBlock).toContain('runRotoSessionResult(result)');
    expect(coordinatorBlock).toContain('pendingRotoAdvanceRef.current = targetFrame');
    expect(coordinatorBlock).toContain('const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current');
    expect(coordinatorBlock).toContain('if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current)');
    expect(text).toContain('saveOnLeaveSourceFrameRef.current = effect.frame');
    expect(navigateBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(navigateBlock).not.toContain('flushRotoFrame(sourceFrame');
    expect(frameNavBlock).toContain('first: 0');
    expect(frameNavBlock).toContain('previous: Math.max(0, input.currentFrame - 1)');
    expect(frameNavBlock).toContain('next: input.currentFrame + 1');
    expect(frameNavBlock).toContain('last: Math.max(input.currentFrame, highestSavedFrame, playEndFrame, input.framesToApply - 1)');
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
    const saveBlock = rotoSaveControllerSource();

    expect(text).toContain('const openSyncedRotoFrameAfterSave = useCallback');
    expect(navigateBlock).toContain("if (rotoFlushInFlightRef.current || applyStatus === 'applying') return false");
    expect(internalAdvanceBlock).toContain('rotoCachedPlayback.stop()');
    expect(internalAdvanceBlock).toContain('loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine)');
    expect(internalAdvanceBlock).toContain('await sendPhysicPaintFrameSyncMessage(frame, bridgeMode)');
    expect(internalAdvanceBlock).toContain('setLaunchContext((current) => current ? { ...current, startFrame: frame } : current)');
    expect(internalAdvanceBlock).not.toContain("applyStatus === 'applying'");
    expect(internalAdvanceBlock).not.toContain('rotoFlushInFlightRef.current');
    const controller = rotoApplyResultControllerSource();
    expect(controller).toContain('void input.openFrameAfterSave(nextFrame).then(() => {');
    expect(controller).not.toContain('void navigateToSyncedFrame(nextFrame)');
    expect(controller).toContain('const nextFrame = input.pendingAdvanceRef.current');
    expect(controller).toContain('input.pendingAdvanceRef.current = null');
    expect(controller).toContain("completion.type === 'failure'");
    expect(controller).toContain('input.saveOnLeaveRenderedFrameRef.current = null');
    expect(coordinatorBlock).toContain('const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current');
    expect(coordinatorBlock).toContain('if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current)');
    expect(coordinatorBlock).toContain('pendingRotoAdvanceRef.current = targetFrame');
    expect(coordinatorBlock).toContain('return false');
    expect(coordinatorBlock).not.toContain('if (saveOnLeaveSourceFrameRef.current !== null && rotoFlushInFlightRef.current)');
    expect(saveBlock).toContain('rotoInterpolationSettings: saveTransaction.interpolationSettings');
    expect(text).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
  });

  it('keeps Phase 36.6 failed save-on-leave on the dirty source and clears queued navigation (D-10, D-11, D-12)', () => {
    const text = source();
    const timeoutBlock = rotoApplyLifecycleSource().slice(rotoApplyLifecycleSource().indexOf('const startApplyTimeout = useCallback'), rotoApplyLifecycleSource().indexOf('useEffect(() => clearApplyTimeout'));

    const controller = rotoApplyResultControllerSource();
    expect(controller).toContain('const nextFrame = input.pendingAdvanceRef.current');
    expect(controller).toContain("completion.type === 'failure'");
    expect(controller).toContain('input.pendingAdvanceRef.current = null');
    expect(controller).toContain('input.saveOnLeaveSourceFrameRef.current');
    expect(controller).toContain('input.saveOnLeaveRenderedFrameRef.current = null');
    expect(controller).toContain('input.saveOnLeaveDeleteFrameRef.current = null');
    expect(rotoApplyTransactionsSource()).toContain('Could not save frame ${saveOnLeaveSourceFrame}');
    expect(rotoApplyTransactionsSource()).toContain('try navigating again to retry');
    expect(controller.indexOf('return true;')).toBeLessThan(controller.indexOf('void input.openFrameAfterSave(nextFrame)'));
    expect(timeoutBlock).toContain('pendingRotoAdvanceRef.current = null');
    expect(timeoutBlock).toContain('transitionRotoApplyTimeout(getSnapshot(), operationId)');
    expect(rotoApplyTransactionsSource()).toContain('Could not save frame ${saveOnLeaveSourceFrame}');
    expect(text).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
    expect(rotoApplyLifecycleSource()).toContain('const closeAfterApplyOperationIdRef = useRef<string | null>(null)');
  });

  it('clears save-on-leave source tracking on terminal paths while preserving the apply-result origin guard (D-12, D-16)', () => {
    const text = source();
    const timeoutBlock = rotoApplyLifecycleSource().slice(rotoApplyLifecycleSource().indexOf('const startApplyTimeout = useCallback'), rotoApplyLifecycleSource().indexOf('useEffect(() => clearApplyTimeout'));
    const bridge = parentBridgeSource();
    const listenerBlock = bridge.slice(bridge.indexOf('const handleMessageResult ='), bridge.indexOf('window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT'));

    const controller = rotoApplyResultControllerSource();
    expect(controller).toContain('input.saveOnLeaveSourceFrameRef.current = null');
    expect(controller).toContain('input.saveOnLeaveRenderedFrameRef.current = null');
    expect(controller).toContain('input.saveOnLeaveDeleteFrameRef.current = null');
    expect(timeoutBlock).toContain('pendingRotoAdvanceRef.current = null');
    expect(text).toContain('saveOnLeaveRenderedFrameRef.current = null');
    expect(listenerBlock).toContain('if (event.origin !== window.location.origin) return');
    expect(listenerBlock).toContain('isPhysicPaintApplyResultMessage(event.data)');
  });

  it('delegates Roto apply-result completion while retaining Play-specific result copy in Studio', () => {
    const text = source();
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));
    const controller = rotoApplyResultControllerSource();
    const transactions = rotoApplyResultTransactionsSource();

    expect(text).toContain("from './useRotoApplyResultController'");
    expect(text).toContain('const { handleRotoApplyResult } = useRotoApplyResultController({');
    expect(resultBlock).toContain('if (handleRotoApplyResult(transition)) return;');
    expect(resultBlock).toContain("detail.kind === 'update-play-render-options'");
    expect(resultBlock).toContain("detail.kind === 'apply-play-canvas'");
    expect(resultBlock).toContain("detail.kind === 'convert-play-to-roto'");
    expect(resultBlock).toContain("detail.kind === 'convert-roto-to-play'");
    expect(resultBlock).not.toContain("detail.kind === 'apply-canvas'");
    expect(resultBlock).not.toContain("detail.kind === 'delete-roto-frame'");
    expect(controller).not.toContain('useEffect');
    expect(controller).toContain('input.onSessionSaveSucceeded(frame)');
    expect(controller).toContain('input.setCachedRepaintBaseFrame(mergedFrame.renderedFrame)');
    expect(controller).toContain('input.restorePreviewBase(engine, mergedFrame.renderedFrame.dataUrl)');
    expect(controller).toContain('void input.openFrameAfterSave(nextFrame).then(() => {');
    expect(controller).toContain('void input.closeWindow()');
    expect(transactions).toContain("'replace-roto-key-frames'");
    expect(transactions).toContain("'update-roto-interpolation-settings'");
  });

  it('validates apply result kind and frame before clearing Roto save-on-leave state', () => {
    const text = source();
    const flushBlock = rotoSaveControllerSource();
    const resultBlock = text.slice(text.indexOf('const handleApplyResult = useCallback'), text.indexOf('useEffect(() => {', text.indexOf('const handleApplyResult = useCallback')));

    expect(rotoApplyLifecycleSource()).toContain('const pendingApplyRef = useRef<PendingPhysicPaintApply | null>(null)');
    const savePlayBlock = text.slice(text.indexOf('const savePlay = useCallback'), text.indexOf('const saveEditableState = useCallback'));

    expect(flushBlock).toContain('registerPendingApply(payload)');
    expect(savePlayBlock).toContain('registerPendingApply(payload)');
    expect(savePlayBlock.indexOf('registerPendingApply(payload)')).toBeLessThan(savePlayBlock.indexOf('await sendPhysicPaintApplyPayload(payload, bridgeMode)'));
    expect(resultBlock).toContain('const transition = matchApplyResult(detail)');
    expect(rotoApplyTransactionsSource()).toContain('detail.kind !== pendingApply.kind || detail.startFrame !== pendingApply.startFrame');
    expect(rotoApplyLifecycleSource()).toContain("if (transition.type === 'accepted') clearActiveApply()");
    expect(rotoApplyLifecycleSource()).toContain('pendingApplyRef.current = null');
  });

  it('does not mutate local marker ownership after deleted Roto save-on-leave frames apply', () => {
    const controller = rotoApplyResultControllerSource();

    expect(source()).toContain('if (handleRotoApplyResult(transition)) return;');
    expect(controller).toContain('const deletedFrame = input.saveOnLeaveDeleteFrameRef.current === frame');
    expect(controller).toContain('input.removeCachedFrame(frame)');
    expect(controller).toContain('if (deletedFrame) input.removeEditableFrame(frame)');
    expect(controller).not.toContain('setSavedRotoFrames');
    expect(controller).not.toContain('setOccupiedRotoFrames');
  });

  it('disables Roto canvas input while save-on-leave is applying or the current display frame is generated', () => {
    const text = source();
    const canvasBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('</PhysicsPaintCanvasStack>'));
    const dirtyBlock = text.slice(text.indexOf('const markCurrentRotoFrameDirty = useCallback'), text.indexOf('const beginRotoFrameEdit = useCallback'));

    expect(text).toContain('const rotoTimelineModel = useRotoTimelineModel');
    expect(text).toContain('const currentFrameIsGeneratedRoto = workflowMode === \'roto\' && rotoTimelineModel.currentFrameIsGenerated.value');
    expect(text).not.toContain("const currentFrameIsGeneratedRoto = currentRotoDisplayFrame?.source === 'generated-interpolation'");
    expect(text).toContain("const rotoInputDisabled = workflowMode === 'roto' && ((Boolean(saveOnLeaveSourceFrameRef.current) && applyStatus === 'applying') || currentFrameIsGeneratedRoto)");
    expect(dirtyBlock).toContain('if (currentFrameIsGeneratedRoto) {');
    expect(dirtyBlock).toContain('is render-only. Use timeline navigation or playback; edit a real Roto key to paint.');
    expect(canvasBlock).toContain('inputDisabled={rotoInputDisabled}');
    expect(canvasBlock).toContain("inputDisabledMessage={currentFrameIsGeneratedRoto ? `Generated frame ${currentFrame} is render-only.` : 'Saving current Roto frame…'}");
  });

  it('wires explicit current-frame Roto saves without repeated brush-move apply calls', () => {
    const text = source();
    const canvasBlock = text.slice(text.indexOf('<PhysicsPaintCanvasStack'), text.indexOf('</PhysicsPaintCanvasStack>'));
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));

    expect(text).toContain('useRotoKeyUtilities');
    expect(text).not.toContain('const [rotoSessionVersion, setRotoSessionVersion] = useState(0)');
    expect(text).toContain('const markCurrentRotoFrameDirty = useCallback');
    expect(text).toContain('const beginRotoFrameEdit = useCallback');
    expect(canvasBlock).toContain('onInputIntent={workflowMode === \'play\' ? beginPlayFrameEdit : beginRotoFrameEdit}');
    expect(workflowStripBlock).toContain('pendingRotoFrames={rotoSession.dirtyFrames.value}');
    expect(workflowStripBlock).toContain('rotoSaveInFlight={Boolean(rotoFlushInFlightRef.current) || applyStatus === \'applying\'}');
    expect(workflowStripBlock).toContain('onSaveRotoFrame={() => { void saveRotoFrame(null); }}');
  });

  it('36.8-REG-09 keeps Copy read-only and preserves copied editable state for Paste', () => {
    const text = source();
    const adapter = rotoKeyUtilitiesSource();
    const sessionBlock = text.slice(text.indexOf('useRotoKeyUtilities'), text.indexOf('const undo = useCallback'));

    expect(text).not.toContain('copiedRotoEditableStateRef');
    expect(adapter).toContain('copiedEditableStateRef.current = input.getEditableState(input.currentFrame)');
    expect(adapter).toContain('copiedEditableState: transaction.operation === \'paste\' ? copiedEditableStateRef.current ?? undefined : undefined');
    expect(adapter).toContain('void runSessionResult(session.pasteKey())');
    expect(sessionBlock).toContain('realKeyFrames: selectRealCachedRotoFrames(launchContext?.cachedRotoFrames)');
  });

  it('clears stale Roto reference overlays on paint input without disabling onion controls', () => {
    const text = source();
    const dirtyBlock = text.slice(text.indexOf('const markCurrentRotoFrameDirty = useCallback'), text.indexOf('const beginRotoFrameEdit = useCallback'));

    expect(dirtyBlock).toContain('clearCachedRotoReferenceUrl()');
    expect(dirtyBlock).toContain('rotoCachedPlayback.stop();');
    expect(dirtyBlock).toContain('(engine as PreviewBackgroundEngine | null)?.resetBackground?.()');
    expect(text).not.toContain('suppressRotoOnionOverlay');
    expect(text).not.toContain('setSuppressRotoOnionOverlay');
  });

  it('keeps real-key utility helpers out of the strict Phase 36.3 Roto strip surface', () => {
    const text = source();
    const workflowStripStart = text.indexOf('<PhysicsPaintWorkflowStrip\n');
    const workflowStripBlock = text.slice(workflowStripStart, text.indexOf('{shortcutsVisible', workflowStripStart));
    const shortcutsBlock = text.slice(text.indexOf('{shortcutsVisible'), text.indexOf('</section>'));

    for (const label of ['duplicateRotoKey', 'insertRotoFrame', 'deleteRotoFrame', 'copyRotoFrame', 'pasteRotoFrame']) {
      expect(text).toContain(label);
    }
    expect(workflowStripBlock).toContain('onDuplicateRotoKey={duplicateRotoKey}');
    expect(workflowStripBlock).toContain('onInsertRotoFrame={insertRotoFrame}');
    expect(workflowStripBlock).toContain('onDeleteRotoFrame={deleteRotoFrame}');
    expect(workflowStripBlock).toContain('onCopyRotoFrame={copyRotoFrame}');
    expect(workflowStripBlock).toContain('onPasteRotoFrame={pasteRotoFrame}');
    expect(workflowStripBlock).toContain('hasCopiedRotoKey={rotoSession.copiedKey.value !== null}');
    expect(shortcutsBlock).not.toContain('Duplicate key');
    expect(shortcutsBlock).not.toContain('Insert frame');
    expect(shortcutsBlock).not.toContain('Delete frame');
    expect(shortcutsBlock).not.toContain('Copy frame');
    expect(shortcutsBlock).not.toContain('Paste frame');
    expect(text).toContain('useRotoKeyUtilities');
    expect(text).toContain('rotoSession.actionAvailability.value');
    expect(text).not.toContain('const rotoSession = useMemo(() => createRotoSession({');
    expect(text).not.toContain('const requireCurrentRealRotoKey = useCallback');
    expect(text).toContain('rotoTimelineActions.updateInterpolationSettings(currentFrame, patch)');
    expect(text).not.toContain('physicPaintStore.regenerateRotoInterpolationCache(launchContext.layerId)');
    expect(text).not.toContain("rotoFrameStatesRef.current.set(result.targetFrame, { source: 'generated-interpolation'");
    expect(text).not.toContain('getNearestRealRotoKeyFrame(currentFrame, physicPaintStore.getRealRotoKeyFrames(launchContext.layerId))');
  });
});
