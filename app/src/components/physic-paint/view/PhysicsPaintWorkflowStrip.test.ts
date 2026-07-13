import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const rightPanelSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintRightPanel.tsx');
const studioSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../PhysicsPaintStudio.tsx');
const studioViewSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintStudioView.tsx');
const playCoordinatorSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/usePhysicsPaintPlayCoordinator.ts');
const rotoPersistenceIntegrationSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoPersistenceIntegration.ts');
const workflowStateSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintWorkflowPresentation.ts');
const rotoSessionSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../roto/physicsPaintRotoSession.ts');
const rotoCacheTransactionsSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../roto/rotoCacheTransactions.ts');
const engineLifecycleSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../engine/usePhysicsPaintEngineLifecycle.ts');
const canvasMountSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../engine/PhysicsPaintCanvasMount.tsx');
const bridgeTransportSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../bridge/physicsPaintBridgeTransport.ts');
const rotoCanvasFramesSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../roto/rotoCanvasFrames.ts');
const rotoInterpolationControllerSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoInterpolationController.ts');
const source = () => readFileSync(sourcePath, 'utf8');
const rightPanelSource = () => readFileSync(rightPanelSourcePath, 'utf8');
const studioSource = () => {
  const persistenceIntegration = readFileSync(rotoPersistenceIntegrationSourcePath, 'utf8')
    .split('const applyKeyFrames = useCallback').join('const applyRotoKeyFrames = useCallback')
    .split('const persistKeyFrameTransaction = useCallback').join('const persistRotoKeyFrameTransaction = useCallback')
    .split('input.frame.setLaunchContext').join('setLaunchContext')
    .split('input.syncKeyFrameLists').join('syncRotoKeyFrameLists')
    .split('input.navigation.playback.stop()').join('rotoCachedPlayback.stop()')
    .split('input.launchContext').join('launchContext')
    .split('input.status.setSavingFrame(effect.frame)').join('setRotoSavingFrame(effect.frame)')
    .split('input.reference.setUrl(null)').join('setCachedRotoReferenceUrl(null)');
  const raw = `${readFileSync(studioSourcePath, 'utf8')}\n${readFileSync(studioViewSourcePath, 'utf8')}\n${readFileSync(playCoordinatorSourcePath, 'utf8')}\n${persistenceIntegration}`;
  const normalizedProps = raw
    .replace(/\b([A-Za-z]\w*): ([^,\n]+)/g, '$1={$2}')
    .replace(/\b([A-Za-z]\w*),/g, '$1={$1}');
  return `${raw}\n${normalizedProps}`;
};
const workflowStateSource = () => readFileSync(workflowStateSourcePath, 'utf8');
const rotoSessionSource = () => readFileSync(rotoSessionSourcePath, 'utf8');
const rotoCacheTransactionsSource = () => readFileSync(rotoCacheTransactionsSourcePath, 'utf8');
const engineLifecycleSource = () => readFileSync(engineLifecycleSourcePath, 'utf8');
const canvasMountSource = () => readFileSync(canvasMountSourcePath, 'utf8');
const bridgeTransportSource = () => readFileSync(bridgeTransportSourcePath, 'utf8');
const rotoCanvasFramesSource = () => readFileSync(rotoCanvasFramesSourcePath, 'utf8');

function getRotoControlsBlock(code: string): string {
  return code.slice(code.indexOf("props.mode === 'roto'"), code.indexOf('physics-paint-play-controls'));
}

function getRotoMapBlock(code: string): string {
  const mapStart = code.indexOf('{frameCells.map(frame =>');
  return code.slice(mapStart, code.indexOf('interpolationConnectors.map', mapStart));
}

function getWorkflowStripPropsInterface(code: string): string {
  return code.slice(code.indexOf('export interface PhysicsPaintWorkflowStripProps'), code.indexOf('const VIRTUAL_TIMELINE_FRAME_COUNT'));
}

function getCssRule(css: string, selector: string): string {
  const ruleStart = css.indexOf(selector);
  expect(ruleStart).toBeGreaterThan(-1);
  return css.slice(ruleStart, css.indexOf('}', ruleStart));
}

describe('PhysicsPaintWorkflowStrip source contract', () => {
  it('36.13/D-14/D-17 shows compact custom-span and generated render-only guidance without reset/apply-all controls', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const rotoStatusBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('{confirmation ?'));
    const customSpanRule = getCssRule(css, '.physics-paint-roto-custom-span-status');

    expect(code).toContain('function getSelectedRotoCustomSpanStatus');
    expect(code).toContain('Custom span: ${customSpan.inBetweenCount} in-betweens');
    expect(rotoStatusBlock).toContain('physics-paint-roto-custom-span-status');
    expect(rotoStatusBlock).toContain('getSelectedRotoCustomSpanStatus');
    expect(rotoStatusBlock).toContain('Generated frame {frame} is render-only');
    expect(customSpanRule).toContain('border');
    expect(customSpanRule).toContain('font-size');
    expect(code).not.toMatch(/reset custom|Reset custom|apply to all|Apply to all|apply-all|reset-spacing/i);
    expect(code).not.toMatch(/toast|tutorial|blocking overlay/i);
  });

  it('exports the workflow strip component and props', () => {
    const code = source();

    expect(code).toContain('export interface PhysicsPaintWorkflowStripProps');
    expect(code).toContain('export function PhysicsPaintWorkflowStrip');
  });

  it('renders a locked standalone mode label instead of Roto and Play workflow tabs', () => {
    const code = source();

    const stateCode = workflowStateSource();

    expect(code).toContain('getPhysicsPaintSourceLabel');
    expect(code).toContain('{getPhysicsPaintSourceLabel(props.mode)}');
    expect(stateCode).toContain('Roto #1');
    expect(stateCode).toContain('Play #2');
    const modeLabelBlock = code.slice(code.indexOf('physics-paint-mode-label'), code.indexOf('physics-paint-workflow-animation'));

    expect(code).not.toContain("props.mode === 'roto' ? 'Roto paint' : 'Play paint'");
    expect(modeLabelBlock).toContain('{getPhysicsPaintSourceLabel(props.mode)}');
    expect(modeLabelBlock).not.toContain('Roto paint');
    expect(modeLabelBlock).not.toContain('Play paint');
    expect(code).toContain('physics-paint-mode-label');
    expect(code).not.toContain('role="tablist"');
    expect(code).not.toContain('role="tab"');
    expect(code).not.toContain('Roto canvas');
    expect(code).not.toContain('Play canvas');
    expect(code).not.toContain('function requestWorkflowModeChange');
    expect(code).not.toContain('onRequestModeChange');
    expect(code).not.toContain('Save roto frame');
    expect(code).not.toContain('Save pending');
    expect(code).toContain('Save current');
    expect(code).toContain('Render play');
    expect(code).not.toContain('Preview / Save Play');
    expect(code).toContain('Preview cached Play frames, or render and save the Play cache when it is stale.');
    expect(code).toContain('Stop');
    expect(rightPanelSource()).toContain('Save state');
    expect(rightPanelSource()).toContain('Load state');
  });

  it('routes apply and save/load messages to the right-panel Log tab', () => {
    const rightPanel = rightPanelSource();
    const studio = studioSource();

    expect(rightPanel).toContain("const logVisible = Boolean(devExportEnabled || applyMessage || error || applyStatus === 'applying')");
    expect(rightPanel).toContain('physics-paint-log-message');
    expect(rightPanel).toContain('{applyMessage ? <p class={`physics-paint-log-message ${applyStatus}`}>{applyMessage}</p> : null}');
    expect(studio).toContain('applyMessage={applyMessage}');
    expect(studio).toContain('error={lastError}');
  });

  it('owns physics-paint-specific timeline rows without importing the main EFX Motion timeline', () => {
    const code = source();

    expect(code).toContain('physics-paint-timeline');
    expect(code).toContain('physics-paint-roto-cell');
    expect(code).toContain('occupiedRotoFrames');
    expect(code).toContain('isOccupiedFrame');
    expect(code).toContain('physics-paint-play-cells');
    expect(code).toContain('buildPlayFrameCells');
    expect(code).toContain('getPlayRangeMarker');
    expect(code).not.toMatch(/from ['"].*Timeline/);
    expect(code).not.toContain('<Timeline');
  });

  it('keeps Play lane clicks as local preview without syncing the editor playhead', () => {
    const code = source();
    const previewIndex = code.indexOf('onPreviewPlayFrame');
    const inspectIndex = code.indexOf('onInspectPlayFrame');
    const convertIndex = code.indexOf('onConvertPlayToRoto');
    const playCellsBlock = code.slice(code.indexOf('playFrameCells.map'), code.indexOf('playFrameCells.map') + 900);

    expect(previewIndex).toBeGreaterThan(-1);
    expect(inspectIndex).toBeGreaterThan(-1);
    expect(convertIndex).toBeGreaterThan(-1);
    expect(code).not.toContain('onClearPlayRange');
    const previewBlock = code.slice(code.indexOf('function previewPlayFrame'), code.indexOf('function getConfirmationCopy'));

    expect(code).toContain('playFrameCells.map');
    expect(playCellsBlock).toContain('previewPlayFrame(index)');
    expect(previewBlock).toContain('props.onPreviewPlayFrame');
    expect(playCellsBlock).not.toContain('onNavigateToSyncedFrame');
    expect(playCellsBlock).not.toContain('onConvertPlayToRoto');
  });

  it('accepts local Play preview props and renders current Play frame cells', () => {
    const code = source();

    for (const contract of [
      'currentPreviewFrame?: number',
      'maxPlayFrameCount?: number',
      'maxPlayFrameCountReason?: string',
      'playCacheStatus?:',
      'onPreviewPlayFrame?: (frame: number) => void',
      'physics-paint-play-cell',
      'clampedPreviewFrame',
    ]) {
      expect(code).toContain(contract);
    }
    expect(code).not.toContain('physics-paint-play-range-point current');
  });

  it('renders Play as frame cells from the script start and colors cached ranges distinctly', () => {
    const code = source();

    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');

    expect(code).toContain('const PLAY_TIMELINE_CELL_WIDTH');
    expect(code).toContain('buildPlayFrameCells(props.startFrame, safeFrameCount)');
    expect(code).toContain("props.playCacheStatus === 'cached' ? 'cached' : ''");
    expect(code).toContain('physics-paint-play-cells');
    expect(code).toContain('buildPlayFrameCells(11, 1)');
    expect(css).toContain('.physics-paint-play-cell.cached');
  });

  it('documents one-frame Play gap cells as the launch frame only', () => {
    const code = source();

    expect(code).toContain('buildPlayFrameCells(11, 1)');
    expect(code).toContain('[11]');
  });

  it('renders Roto interpolation as connector lines and filters generated cache from square cells', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const rotoBlock = code.slice(code.indexOf('props.mode === \'roto\''), code.indexOf('physics-paint-lane physics-paint-play-lane'));

    expect(code).toContain('rotoInterpolationSettings?: RotoInterpolationSettings');
    expect(code).toContain('cachedRotoFrames?: PhysicPaintRotoCacheFrame[]');
    expect(code).toContain("source?: 'real-key' | 'generated-interpolation'");
    expect(code).toContain("marker.source !== 'generated-interpolation'");
    expect(rotoBlock).toContain('physics-paint-roto-interpolation-connector');
    expect(rotoBlock).toContain('connector-count-${connector.total}');
    expect(rotoBlock).toContain('data-generated-frame={connector.frame}');
    expect(rotoBlock).not.toContain("source === 'generated-interpolation') ? <button");
    expect(css).toContain('.physics-paint-roto-interpolation-connector');
    expect(css).toContain('pointer-events: none');
  });

  it('keeps Roto interpolation explanatory copy out of the strict Phase 36.3 Roto strip', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).not.toContain('getRotoInterpolationStatusCopy');
    expect(rotoControlsBlock).not.toContain('Interpolation needs two real Roto keys.');
    expect(rotoControlsBlock).not.toContain('Generated in-betweens are render-only; connector lines mark interpolation spans.');
    expect(rotoControlsBlock).not.toContain('Generated in-betweens stay render-only, not editable targets.');
    expect(code).not.toContain('Generated in-betweens are editable');
    expect(css).toContain('.physics-paint-roto-interpolation-status');
  });

  it('uses materialized generated cache frames only while Roto interpolation is enabled', () => {
    const code = source();
    const mapBlock = getRotoMapBlock(code);

    expect(code).toContain('function normalizeRotoCacheForDisabledInterpolation');
    expect(code).toContain(".filter(frame => frame.source !== 'generated-interpolation')");
    expect(code).toContain('return { ...frame, appFrame: sourceFrame, sourceFrame, displayFrame: sourceFrame };');
    expect(code).toContain('const displayCachedRotoFrames = useMemo(() => getDisplayRotoCacheFrames(props.cachedRotoFrames, interpolationEnabled)');
    expect(code).toContain('const materializedGeneratedRotoFrames = useMemo(() => interpolationEnabled ? displayCachedRotoFrames');
    expect(code).toContain('const hasMaterializedGeneratedRotoFrames = interpolationEnabled && materializedGeneratedRotoFrames.length > 0');
    expect(code).toContain('const displayOccupiedRotoFrames = useMemo(() => !interpolationEnabled && realCachedRotoFrames.length > 0 ? realCachedRotoFrameNumbers : props.occupiedRotoFrames');
    expect(code).toContain('const displaySavedRotoFrames = useMemo(() => !interpolationEnabled && realCachedRotoFrames.length > 0 ? realCachedRotoFrameNumbers.map');
    expect(code).toContain('hasMaterializedGeneratedRotoFrames || (!interpolationEnabled && realCachedRotoFrames.length > 0)');
    expect(code).toContain('? realCachedRotoFrameNumbers : getRealRotoFrames');
    expect(code).toContain('hasMaterializedGeneratedRotoFrames ? realRotoFrames.map(frame => ({ sourceFrame: frame, frame })) : getExpandedRotoRealKeyFrames');
    expect(code).toContain('hasMaterializedGeneratedRotoFrames ? [] : getRotoInterpolationSpanFrames');
    expect(mapBlock).toContain('const isDisplayRealKey = realCachedRotoFrameNumbers.includes(frame)');
    expect(mapBlock).toContain('isDisplayRealKey || isOccupiedFrame(displayOccupiedRotoFrames, frame)');
    expect(mapBlock).toContain('isDisplayRealKey || isSavedFrame(displaySavedRotoFrames, frame)');
  });

  it('36.12 UAT Test 8/D-18 exposes Duplicate-only count controls in the visible strip', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).toContain('onRotoInterpolationEnabledChange?: (enabled: boolean) => void');
    expect(code).toContain('onRotoInterpolationCountChange?: (count: number) => void');
    expect(studioSource()).toContain('onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })');
    expect(code).not.toContain('onRotoInterpolationModeChange?:');
    expect(rotoControlsBlock).toContain('props.onRotoInterpolationEnabledChange ?');
    expect(rotoControlsBlock).toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation</span>');
    expect(rotoControlsBlock).toContain('Blend size={14}');
    expect(rotoControlsBlock).toContain('Generated in-between frames per real-key pair');
    expect(rotoControlsBlock).toContain('min="1"');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-interpolation-select');
    expect(rotoControlsBlock).not.toContain('aria-label="Generated in-between mode"');
    expect(rotoControlsBlock).not.toContain('Duplicate');
    expect(rotoControlsBlock).not.toContain('value="blend"');
    expect(rotoControlsBlock).not.toContain('In-betweens</span>');
    expect(rotoControlsBlock).not.toContain('Per adjacent real-key pair');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation mode</span>');
    expect(rotoControlsBlock).not.toContain('Interpolation gap frames');
    expect(rotoControlsBlock).not.toContain('Gaps');
  });

  it('36.8-REG-06/D-18 keeps the contextual Roto key utility pill in the timeline lane outside the header', () => {
    const code = source();
    const timelineBlock = code.slice(code.indexOf('physics-paint-timeline'), code.indexOf('physics-paint-roto-status-stack'));
    const headerBlock = code.slice(code.indexOf('physics-paint-workflow-header'), code.indexOf('physics-paint-timeline'));
    const keyUtilityBlock = timelineBlock.slice(timelineBlock.indexOf('physics-paint-roto-key-utilities'), timelineBlock.indexOf('</div>', timelineBlock.indexOf('physics-paint-roto-key-utilities')));

    for (const contract of [
      'onDuplicateRotoKey?: () => void',
      'onInsertRotoFrame?: () => void',
      'onDeleteRotoFrame?: () => void',
      'onCopyRotoFrame?: () => void',
      'onPasteRotoFrame?: () => void',
      'hasCopiedRotoKey?: boolean',
      'keyActionInFlight?: boolean',
    ]) {
      expect(code).toContain(contract);
    }
    expect(timelineBlock).toContain('physics-paint-roto-key-utilities');
    expect(timelineBlock).toContain('Roto key utilities for frame');
    expect(timelineBlock).toContain('Key {props.currentFrame}');
    expect([...keyUtilityBlock.matchAll(/>(Insert|Dup|Copy|Paste|Delete)<\/button>/g)].map((match) => match[1])).toEqual(['Insert', 'Dup', 'Copy', 'Paste', 'Delete']);
    expect(keyUtilityBlock).toContain('aria-label={`Insert blank Roto key before frame ${props.currentFrame}`}');
    expect(keyUtilityBlock).toContain('aria-label={`Duplicate Roto key at frame ${props.currentFrame}`}');
    expect(keyUtilityBlock).toContain('aria-label={`Copy Roto key at frame ${props.currentFrame}`}');
    expect(keyUtilityBlock).toContain('aria-label={`Paste Roto key to frame ${props.currentFrame}`}');
    expect(keyUtilityBlock).toContain('aria-label={`Delete Roto key at frame ${props.currentFrame}`}');
    expect(keyUtilityBlock).toContain('physics-paint-roto-key-button destructive');
    expect(headerBlock).not.toContain('physics-paint-roto-key-utilities');
    expect(headerBlock).not.toContain('Duplicate Roto key');
  });

  it('36.8-REG-06/D-18 keeps Save/current dirty/reference status copy unchanged', () => {
    const code = source();
    const statusStackBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('confirmation ? ('));

    expect(code).toContain('aria-label="Save current"');
    expect(code).toContain('Save current');
    expect(statusStackBlock).toContain('Dirty frames save when leaving.');
    expect(statusStackBlock).toContain('Cached reference: repaintable, not stroke-editable.');
  });

  it('D-03 keeps WorkflowStrip Roto key/cache state on the existing compact session-derived prop surface', () => {
    const propsInterface = getWorkflowStripPropsInterface(source());
    const rotoKeyCacheProps = [...propsInterface.matchAll(/^\s+(\w*(?:Roto|roto)\w*)\??:/gm)].map((match) => match[1]);

    expect(rotoKeyCacheProps).toEqual([
      'occupiedRotoFrames',
      'savedRotoFrames',
      'cachedRotoFrames',
      'editableRotoFrames',
      'pendingRotoFrames',
      'rotoSaveInFlight',
      'rotoSavingFrame',
      'rotoInterpolationSettings',
      'rotoMissingFrameStatusKind',
      'rotoCachedPlaybackAvailable',
      'rotoCachedPlaybackStatus',
      'rotoCachedPlaybackLoop',
      'rotoCachedPlaybackFps',
      'onToggleRotoPlayback',
      'onRotoPlaybackLoopChange',
      'onRotoPlaybackFpsChange',
      'isRotoCachedPlaybackActive',
      'onRotoInterpolationEnabledChange',
      'onRotoInterpolationCountChange',
      'onRotoInterpolationMotionChange',
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
  });

  it('uses native accessible disabled Roto key buttons and scoped feedback (D-12, D-13, D-15)', () => {
    const code = source();
    const timelineBlock = code.slice(code.indexOf('physics-paint-timeline'), code.indexOf('physics-paint-roto-status-stack'));
    const statusBlock = code.slice(code.indexOf('function getRotoKeyUtilityDisabledMessage'), code.indexOf('const updateScrollbar'));

    expect(code).toContain('const isCurrentRealRotoKey');
    expect(code).toContain('const keyUtilitiesDisabledByBusyState');
    expect(code).toContain('const canPasteRotoKey');
    expect(code).toContain('const canUseVisibleSourceRotoKey = canUseSourceRotoKey || (Boolean(sessionKeyAvailability) && isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState)');
    expect(code).toContain('const canCopyRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canCopy || canUseVisibleSourceRotoKey) && props.ready !== false : canUseSourceRotoKey');
    expect(code).toContain('const canPasteRotoKey = sessionKeyAvailability ? sessionKeyAvailability.canPaste && props.ready !== false : Boolean(props.hasCopiedRotoKey) && !keyUtilitiesDisabledByBusyState');
    expect(timelineBlock).toContain('type="button"');
    expect(timelineBlock).toContain('aria-label={`Insert blank Roto key before frame ${props.currentFrame}`}');
    expect(timelineBlock).toContain('aria-label={`Duplicate Roto key at frame ${props.currentFrame}`}');
    expect(timelineBlock).toContain('aria-label={`Copy Roto key at frame ${props.currentFrame}`}');
    expect(timelineBlock).toContain('aria-label={`Paste Roto key to frame ${props.currentFrame}`}');
    expect(timelineBlock).toContain('aria-label={`Delete Roto key at frame ${props.currentFrame}`}');
    expect(timelineBlock).toContain('disabled={!canInsertRotoKey}');
    expect(timelineBlock).toContain('disabled={!canDuplicateRotoKey}');
    expect(timelineBlock).toContain('disabled={!canCopyRotoKey}');
    expect(timelineBlock).toContain('disabled={!canPasteRotoKey}');
    expect(timelineBlock).toContain('disabled={!canDeleteRotoKey}');
    expect(timelineBlock).toContain('physics-paint-roto-key-button destructive');
    for (const copy of [
      'Select a real Roto key to insert.',
      'Select a real Roto key to duplicate.',
      'Select a real Roto key to copy.',
      'Select a real Roto key to delete.',
      'Copy a real Roto key before pasting.',
      'Generated frame {frame} is render-only.',
      'Finish saving frame {frame} before using key tools.',
    ]) {
      expect(statusBlock).toContain(copy);
    }
  });

  it('keeps Phase 36.7 key utilities inside existing Preact/CSS scope only (D-14)', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');

    expect(code).not.toMatch(/from ['"]react['"]/);
    expect(code).not.toMatch(/from ['"]@radix-ui\//);
    expect(code).not.toContain('useHotkeys');
    expect(code).not.toContain('addEventListener(\'keydown\'');
    expect(code).not.toContain('addEventListener("keydown"');
    expect(code).not.toContain('toast');
    expect(code).not.toContain('shadcn');
    expect(code).not.toContain('className="');
    expect(css).toContain('.physics-paint-roto-key-utilities');
    expect(css).toContain('.physics-paint-roto-key-context');
    expect(css).toContain('.physics-paint-roto-key-button.destructive');
    expect(css).toContain('.physics-paint-roto-key-button:active:not(:disabled)');
    expect(css).toContain('.physics-paint-roto-key-button[data-pressed="true"]');
    expect(code).toContain('onPointerDown: () => setPressedRotoKeyAction(action)');
    expect(code).toContain("'data-pressed': pressedRotoKeyAction === action");
  });

  it('keeps Roto key transactions authoritative after local apply instead of re-reading stale cache state', () => {
    const studioCode = studioSource();
    const adapter = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoKeyUtilities.ts'), 'utf8');
    const applyBlock = studioCode.slice(studioCode.indexOf('const applyRotoKeyFrames = useCallback'), studioCode.indexOf('const persistRotoKeyFrameTransaction'));
    const resultBlock = studioCode.slice(studioCode.indexOf("if (detail.kind === 'replace-roto-key-frames')"), studioCode.indexOf("} else if (detail.kind === 'update-play-render-options')"));

    expect(applyBlock).toContain('physicPaintStore.replaceRotoKeyFrames({');
    expect(applyBlock).toContain('physicPaintStore.getRotoCacheFrames(launchContext.layerId)');
    expect(adapter).toContain('const publishedFrames = refreshedCacheFrames.length > 0 ? refreshedCacheFrames : transaction.realKeyFrames');
    expect(adapter).toContain('input.syncRotoKeyFrameLists(publishedFrames)');
    expect(resultBlock).not.toContain('syncRotoKeyFrameLists(getRealRotoKeyFramesForStudio())');
  });

  it('remounts the physics engine when bounded working canvas dimensions change', () => {
    const studioCode = studioSource();

    expect(studioCode).toContain('const projectCanvasWidth = launchContext?.width ?? DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH');
    expect(studioCode).toContain('const workingCanvasSize = getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight)');
    expect(studioCode).toContain('const canvasKey = `${canvasWidth}x${canvasHeight}`');
    expect(engineLifecycleSource()).toContain('setEngine(null);');
    expect(engineLifecycleSource()).toContain('setCanvasMounted(false);');
    expect(studioCode).toContain('key={canvas.canvasKey}');
    expect(studioCode).toContain('canvasKey,');
  });

  it('passes bounded working canvas dimensions into Roto session transaction building', () => {
    const studioCode = studioSource();
    const sessionCode = rotoSessionSource();

    expect(studioCode).toContain('canvasSize: { width: canvasWidth, height: canvasHeight }');
    expect(sessionCode).toContain('canvasSize: input.canvasSize');
    expect(sessionCode).toContain('normalizeRealKeyFrames(input.realKeyFrames, input.canvasSize)');
    expect(sessionCode).toContain('normalizeCachedFrames(input.cachedRotoFrames, input.canvasSize)');
  });

  it('36.12 UAT Test 8/D-19 renders compact Duplicate-only Roto interpolation count controls', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).toContain('onRotoInterpolationEnabledChange?: (enabled: boolean) => void');
    expect(code).toContain('onRotoInterpolationCountChange?: (count: number) => void');
    expect(studioSource()).toContain('onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })');
    expect(code).not.toContain('onRotoInterpolationModeChange?:');
    expect(rotoControlsBlock).toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation</span>');
    expect(rotoControlsBlock).toContain('Blend size={14}');
    expect(rotoControlsBlock).toContain('Generated in-between frames per real-key pair');
    expect(rotoControlsBlock).not.toContain('aria-label="Generated in-between mode"');
    expect(rotoControlsBlock).not.toContain('Duplicate');
    expect(rotoControlsBlock).not.toContain('value="blend"');
    expect(rotoControlsBlock).not.toContain('Per adjacent real-key pair');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation mode</span>');
    expect(rotoControlsBlock).not.toContain('Gaps');
  });

  it('36.12 Studio wires visible interpolation count through store-owned regeneration and compact status copy', () => {
    const studioCode = studioSource();
    const toggleBlock = readFileSync(rotoInterpolationControllerSourcePath, 'utf8');
    const cacheTransactions = rotoCacheTransactionsSource();
    const stripStart = studioCode.indexOf('    workflow: {');
    const stripPropsBlock = studioCode.slice(stripStart, studioCode.indexOf('    status:', stripStart));

    expect(toggleBlock).toContain('input.updateSettings(input.currentFrame, patch)');
    expect(toggleBlock).not.toContain('mode: patch.mode ?? currentSettings.mode');
    expect(studioCode).toContain('physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, settings)');
    expect(toggleBlock).toContain('const cacheRefresh = refreshRotoInterpolationCache(');
    expect(cacheTransactions).toContain('.map(normalizeCachedRotoRealKeySourceFrame)');
    expect(cacheTransactions).toContain('const frames = storeFrames.length > 0');
    expect(cacheTransactions).toContain("storeFrames.filter((frame) => enabled || frame.source === 'real-key')");
    expect(cacheTransactions).toContain('realDisplayFrames: realKeys.map((frame) => frame.displayFrame ?? frame.appFrame)');
    expect(toggleBlock).toContain('input.setEditableFrames((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)))');
    expect(toggleBlock).not.toContain('setOccupiedRotoFrames');
    expect(toggleBlock).toContain('startFrame: transaction.nextCurrentFrame');
    expect(toggleBlock).not.toContain('physicPaintStore.regenerateRotoInterpolationCache(launchContext.layerId)');
    expect(studioCode).toContain('physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId)');
    expect(toggleBlock).toContain('setApplyMessage(transaction.status)');
    expect(toggleBlock).not.toContain('Generated in-betweens could not regenerate. Real keys were kept.');
    expect(toggleBlock).not.toContain('Generated in-betweens on — render-only frames refresh from real keys.');
    expect(toggleBlock).not.toContain('Generated in-betweens on — save at least two real Roto keys.');
    expect(toggleBlock).not.toContain('Generated in-betweens off — real Roto keys only.');
    expect(stripPropsBlock).toContain('onRotoInterpolationEnabledChange: (enabled) => updateRotoInterpolationSettings({ enabled })');
    expect(stripPropsBlock).toContain('onRotoInterpolationCountChange: (inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })');
    expect(stripPropsBlock).not.toContain('onRotoInterpolationModeChange=');
    expect(stripPropsBlock).not.toContain('onRotoInterpolationMotionChange=');
  });

  it('uses Render play plus a separate Update action for saved Play options', () => {
    const code = source();
    const playControlsIndex = code.indexOf('physics-paint-play-controls');
    const playControlsBlock = code.slice(playControlsIndex, playControlsIndex + 3600);

    expect(code).toContain('const RENDER_ACTION_LABEL = \'Render play\'');
    expect(code).toContain('const RENDER_ACTION_HELP = \'Preview cached Play frames, or render and save the Play cache when it is stale.\'');
    expect(code).toContain('onUpdatePlayOptions?: () => void');
    expect(playControlsBlock).toContain('title={RENDER_ACTION_HELP}');
    expect(playControlsBlock).toContain('aria-label="Render play"');
    expect(playControlsBlock).toContain('>{RENDER_ACTION_LABEL}</button>');
    expect(playControlsBlock).toContain('onClick={renderPlayFrames}');
    expect(playControlsBlock).toContain('aria-label="Update Play options"');
    expect(playControlsBlock).toContain('onClick={props.onUpdatePlayOptions}');
    expect(playControlsBlock).toContain('>Update</button>');
    expect(playControlsBlock).not.toContain('>{SAVE_PLAY_LABEL}</button>');
    expect(playControlsBlock).not.toContain('onClick={props.onSavePlay}');
    expect(code).not.toContain('const SAVE_PLAY_LABEL');
    expect(code).not.toContain('Play, Square');
  });

  it('uses local Play preview navigation for Play canvas transport buttons', () => {
    const code = source();
    const playControlsIndex = code.indexOf('physics-paint-play-controls');
    const playControlsBlock = code.slice(playControlsIndex, playControlsIndex + 3600);

    expect(playControlsBlock).toContain('id="physics-play-duration"');
    expect(playControlsBlock).toContain('onInput={handleFrameCountInput}');
    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(0)}');
    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(Math.max(0, clampedPreviewFrame - 1))}');
    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(Math.min(safeFrameCount - 1, clampedPreviewFrame + 1))}');
    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(safeFrameCount - 1)}');
    expect(playControlsBlock).not.toContain('props.onGoToFirstFrame');
    expect(playControlsBlock).not.toContain('props.onGoToPreviousFrame');
    expect(playControlsBlock).not.toContain('props.onGoToNextFrame');
    expect(playControlsBlock).not.toContain('props.onGoToLastFrame');
  });

  it('exposes stroke deformation and position wiggle controls for Play animation', () => {
    const studioCode = studioSource();
    const panelCode = rightPanelSource();

    expect(panelCode).toContain('export interface PhysicsPaintPlayWiggleSettings');
    expect(panelCode).toContain('MOTION');
    expect(panelCode).toContain('Deform');
    expect(panelCode).toContain('Move');
    expect(panelCode).not.toContain('id="physics-play-duration"');
    expect(panelCode).toContain("updatePlayWiggle('strokeDeformation'");
    expect(panelCode).toContain("updatePlayWiggle('strokePosition'");
    expect(studioCode).toContain('const [playWiggle, setPlayWiggle]');
    expect(studioCode).toContain('playWiggle={playWiggle}');
    expect(studioCode).toContain('onPlayWiggleChange={updatePlayWiggle}');
    expect(studioCode).toContain('wiggle: input.playWiggle');
  });

  it('clamps Play frame count input to maxPlayFrameCount in the animation panel', () => {
    const code = source();

    expect(code).toContain('const maxFrameCount = getMaxFrameCount()');
    expect(code).toContain('Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, props.maxPlayFrameCount)');
    expect(code).toContain('Play duration limited to');
    expect(code).toContain('props.maxPlayFrameCountReason');
    expect(code).toContain('props.onPlayLimit?.(playLimitMessage)');
    expect(code).toContain('max={PHYSIC_PAINT_MAX_APPLY_FRAMES}');
    expect(code).not.toContain('max={maxFrameCount}');
    expect(code).not.toContain('physics-paint-play-limit-message');
    expect(code).toContain('id="physics-play-duration"');
  });

  it('keeps onion preview overlays clipped to the canvas stack and moves onion controls to the right panel', () => {
    const code = source();
    const studioCode = studioSource();
    const panelCode = rightPanelSource();

    expect(code).toContain('onionPreviewFrames');
    expect(code).not.toContain('physics-paint-onion-overlay');
    expect(code).not.toContain('visibleOnionPreviewFrames');
    expect(studioCode).toContain('physics-paint-onion-overlay canvas-region');
    expect(studioCode).toContain('onionOverlay={onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map');
    expect(studioCode).toContain('clampOnionCount');
    for (const label of [
      'physics-paint-options-tabs',
      'physics-paint-single-tab',
      'BRUSH COLOR',
      'TOOL',
      'ONION',
      'MOTION',
      'Onion skin',
      'Previous',
      'Next',
      'Onion value',
      'onOnionChange',
    ]) {
      expect(panelCode).toContain(label);
    }
    expect(code).not.toContain('Onion skin controls');
  });

  it('filters canvas onion preview overlays by count, direction toggles, and live preview state', () => {
    const code = studioSource();
    const projection = readFileSync(fileURLToPath(new URL('../roto/rotoOnionPreview.ts', import.meta.url)), 'utf8');

    expect(code).toContain('const onionPreviewFrames = projectRotoOnionPreviewFrames({');
    expect(projection).toContain('const count = clampOnionCount(input.onion.count)');
    expect(projection).toContain('const traversalFrame = ownerDisplayFrame ?? input.currentFrame');
    expect(projection).toContain('.filter((frame) => frame.appFrame < traversalFrame)');
    expect(projection).toContain('.slice(0, count)');
    expect(projection).toContain("project(frame, 'previous', index + 1)");
    expect(projection).toContain("project(frame, 'next', index + 1)");
    expect(code).toContain('onionPreviewFrames.map');
  });

  it('builds canvas onion previews from Roto sources and does not reuse saved Play frames as yellow overlays', () => {
    const code = studioSource();
    const builderBlock = readFileSync(fileURLToPath(new URL('../roto/rotoOnionPreview.ts', import.meta.url)), 'utf8');
    const coordinator = readFileSync(playCoordinatorSourcePath, 'utf8');
    const savePlayIndex = coordinator.indexOf('const savePlay = useCallback');
    const savePlayBlock = coordinator.slice(savePlayIndex, savePlayIndex + 4200);

    expect(code).toContain('rotoFrameStatesRef');
    expect(code).toContain('rotoPreviewFramesRef');
    expect(code).toContain('snapshotCurrentRotoFrame');
    expect(code).toContain('launchFrames: launchContext?.cachedRotoFrames');
    expect(builderBlock).toContain("if (frame.source && frame.source !== 'real-key') return;");
    expect(builderBlock).toContain('if (frame.backgroundOnly) return;');
    expect(builderBlock).toContain("onionKind: 'stroke-preview'");
    expect(builderBlock).toContain("frame.source === 'real-key' ? 'cached-composite' as const : 'stroke-preview' as const");
    expect(code).toContain('storeFrames: launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : []');
    expect(code).toContain('previewFrames: rotoPreviewFramesRef.current');
    expect(builderBlock).toContain('addRealCandidate(frame)');
    expect(builderBlock).toContain('if (!candidates.has(anchorFrame)) continue;');
    expect(builderBlock.indexOf('input.launchFrames ?? []')).toBeLessThan(builderBlock.indexOf('input.previewFrames ?? []'));
    expect(builderBlock).toContain("project(frame, 'previous', index + 1)");
    expect(builderBlock).toContain("project(frame, 'next', index + 1)");
    expect(builderBlock).not.toContain('latestPlayFrames.forEach');
    expect(builderBlock).not.toContain("addFrame(frame, 'play')");
    expect(builderBlock).not.toContain('physicPaintStore.getFrames');
    expect(savePlayBlock).toContain('editCache.setLatestFrames(frames)');
  });

  it('renders gray, green, and pink Roto cells from real-key cache metadata only (D-03, D-11 through D-16)', () => {
    const code = source();

    expect(code).toContain('cachedRotoFrames?: PhysicPaintRotoCacheFrame[]');
    expect(code).toContain('editableRotoFrames?: number[]');
    expect(code).toContain('pendingRotoFrames?: number[]');
    expect(code).toContain("frame.source === 'real-key'");
    expect(code).toContain('getRotoCellFill(frame, realCachedRotoFrames, props.editableRotoFrames)');
    expect(studioSource()).toContain('editableRotoFrames={editableRotoFrames}');
    expect(studioSource()).not.toContain('editableRotoFrames={occupiedRotoFrames}');
    expect(code).toContain('roto-fill-empty');
    expect(code).toContain('roto-fill-cached-only');
    expect(code).toContain('roto-fill-editable-session');
    expect(code).toContain('Cached reference: repaintable, not stroke-editable');
  });

  it('renders Phase 36.5 Roto cell semantics from the view model in the existing strip (D-02, D-03, D-04)', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const rotoMapBlock = getRotoMapBlock(code);

    expect(code).toContain('getRotoCellViewModel');
    expect(code).toContain('physics-paint-roto-cell-legend');
    expect(rotoMapBlock).toContain('vm.ariaLabel');
    expect(rotoMapBlock).toContain('vm.title');
    expect(rotoMapBlock).toContain('vm.fillClass');
    expect(rotoMapBlock).toContain("vm.overlays.includes('dirty')");
    expect(rotoMapBlock).toContain("vm.overlays.includes('pending')");
    expect(rotoMapBlock).toContain("vm.overlays.includes('current')");

    for (const visibleCopy of ['Roto cell states', 'Empty', 'Cached', 'Current', 'Generated', 'Background only', 'Unsaved', 'Saving']) {
      expect(code).toContain(visibleCopy);
    }
    for (const className of ['roto-fill-cached', 'roto-fill-editable-current', 'roto-fill-generated', 'roto-fill-background-only', 'dirty', 'pending']) {
      expect(code + css).toContain(className);
    }
  });

  it('36.12 D-15 routes generated Roto cell clicks to preview navigation without an editable-open guard', () => {
    const code = source();
    const clickHandlerBlock = code.slice(code.indexOf('function handleRotoCellClick'), code.indexOf('function getGeneratedRotoTitle'));
    const rotoMapBlock = getRotoMapBlock(code);

    expect(rotoMapBlock).toContain("vm.baseMeaning === 'generated'");
    expect(rotoMapBlock).toContain('vm.isEditableTarget === false');
    expect(code).toContain('Generated frame {frame} — render-only.');
    expect(code).toContain('Generated frame {frame} is render-only.');
    expect(rotoMapBlock).toContain('handleRotoCellClick(frame, vm)');
    expect(clickHandlerBlock).toContain("vm.baseMeaning === 'generated'");
    expect(clickHandlerBlock).toContain('props.onNavigateToSyncedFrame(frame)');
    expect(clickHandlerBlock).not.toContain("vm.baseMeaning === 'generated' || vm.isEditableTarget === false) return");
  });

  it('36.12 D-13/D-17/D-20 renders only MVP interpolation count and mode controls in the strip', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(rotoControlsBlock).toContain('props.onRotoInterpolationEnabledChange ?');
    expect(rotoControlsBlock).toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation</span>');
    expect(rotoControlsBlock).toContain('onRotoInterpolationEnabledChange');
    expect(rotoControlsBlock).toContain('Blend size={14}');
    expect(rotoControlsBlock).toContain('Generated in-between frames per real-key pair');
    expect(rotoControlsBlock).not.toContain('aria-label="Generated in-between mode"');
    expect(rotoControlsBlock).not.toContain('Duplicate');
    expect(rotoControlsBlock).not.toContain('value="blend"');
    expect(rotoControlsBlock).not.toContain('Per adjacent real-key pair');
    expect(rotoControlsBlock).not.toContain('<span>Interpolation mode</span>');
    expect(rotoControlsBlock).not.toContain('Interpolation gap frames');
    expect(rotoControlsBlock).not.toContain('Move');
    expect(rotoControlsBlock).not.toContain('Deform');
    expect(rotoControlsBlock).not.toContain('Position');
  });

  it('keeps Phase 36.5 Roto cell scope without excluded advanced controls (36.5-SCOPE-01, D-01, D-05)', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).not.toMatch(/from ['"].*Timeline/);
    expect(code).not.toContain('<Timeline');
    expect(rotoControlsBlock).toContain('props.onRotoInterpolationEnabledChange ?');
    expect(rotoControlsBlock).toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).toContain('Blend size={14}');
    expect(rotoControlsBlock).toContain('Generated in-between frames per real-key pair');
    expect(rotoControlsBlock).not.toContain('In-betweens</span>');
    expect(rotoControlsBlock).not.toContain('Deform');
    expect(rotoControlsBlock).not.toContain('Position');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-key-utilities');
    expect(rotoControlsBlock).not.toContain('Duplicate key');
    expect(rotoControlsBlock).not.toContain('Insert frame');
    expect(rotoControlsBlock).not.toContain('Delete frame');
    expect(rotoControlsBlock).not.toContain('Copy frame');
    expect(rotoControlsBlock).not.toContain('Paste frame');
    expect(rotoControlsBlock).toContain('physics-paint-roto-transport');
    expect(rotoControlsBlock).toContain('Play cached Roto frames');
    expect(rotoControlsBlock).not.toContain('Save on leave');
    expect(rotoControlsBlock).not.toContain('close-choice');
  });

  it('uses Save current copy with pending and ready disabled logic for the strict Phase 36.3 Roto surface', () => {
    const code = source();

    expect(code).not.toContain('Save roto frame');
    expect(code).toContain('onSavePendingRotoFrames: () => void');
    expect(code).toContain('rotoSaveInFlight?: boolean');
    expect(code).toContain('aria-label="Save current"');
    expect(code).toContain('Save current');
    expect(code).toContain('disabled={props.ready === false || !hasPendingRotoFrames || props.rotoSaveInFlight}');
    expect(code).toContain('props.onSaveRotoFrame()');
  });

  it('shows Phase 36.6 save-on-leave feedback without blocking queued Roto navigation', () => {
    const code = source();
    const studio = studioSource();
    const clickHandlerBlock = code.slice(code.indexOf('function handleRotoCellClick'), code.indexOf('function getGeneratedRotoTitle'));
    const statusStackBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('confirmation ? ('));

    expect(code).toContain('rotoSavingFrame?: number | null');
    expect(code).toContain('getRotoPendingLabel(hasPendingRotoFrames, Boolean(props.rotoSaveInFlight), props.rotoSavingFrame)');
    expect(studio).toContain('const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null)');
    expect(studio).toContain('setRotoSavingFrame(effect.frame)');
    expect(studio).toContain('rotoSavingFrame={rotoSavingFrame}');
    expect(studio).toContain('setRotoSavingFrame(null)');
    expect(studio).toContain('setLaunchContext((current) => current ? { ...current, startFrame: frame } : current)');
    expect(studio).toContain('await sendPhysicPaintFrameSyncMessage(frame, input.action.bridgeMode)');
    expect(studio).toContain("from '../bridge/physicsPaintBridgeTransport'");
    expect(bridgeTransportSource()).toContain("await eventApi.emitTo?.('main', 'physic-paint:seek-frame', message)");
    expect(studio).toContain('currentFrame={currentFrame}');
    expect(studio).not.toContain('currentFrame={effectiveCurrentFrame}');
    expect(statusStackBlock).toContain('Dirty frames save when leaving.');
    expect(code).toContain('aria-label="Save current"');
    expect(code).toContain('Save current');
    expect(code).toContain('disabled={props.ready === false || !hasPendingRotoFrames || props.rotoSaveInFlight}');
    expect(clickHandlerBlock).toContain("vm.baseMeaning === 'generated'");
    expect(clickHandlerBlock).toContain('vm.isEditableTarget === false');
    expect(clickHandlerBlock).toContain('props.onNavigateToSyncedFrame(frame)');
    expect(clickHandlerBlock).not.toContain('rotoSaveInFlight');
    expect(statusStackBlock).not.toContain('role="dialog"');
    expect(statusStackBlock).not.toContain('physics-paint-save-on-leave-overlay');
    expect(statusStackBlock).not.toContain('toast');
    expect(statusStackBlock).not.toContain('tutorial');
    expect(code).not.toContain('Save on leave');
    expect(code).not.toContain('Queue destination');
  });

  it('keeps the physics paint canvas bounded inside the canvas region', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const shellRule = getCssRule(css, '.physics-paint-canvas-stack > .demo-canvas-shell');

    expect(shellRule).toContain('height: 100%');
    expect(shellRule).toContain('max-width: 100%');
    expect(shellRule).toContain('max-height: 100%');
    expect(canvasMountSource()).toContain('getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height)');
    expect(css).not.toContain('calc((100vh - 274px) * 1.538)');
  });

  it('keeps current Roto CSS as an outline without adding a fourth fill color', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const currentRule = getCssRule(css, '.physics-paint-roto-cell.current');

    expect(css).toContain('.physics-paint-roto-cell.roto-fill-empty');
    expect(css).toContain('.physics-paint-roto-cell.roto-fill-cached-only');
    expect(css).toContain('.physics-paint-roto-cell.roto-fill-editable-session');
    expect(currentRule).toContain('border-color:');
    expect(currentRule).toContain('outline:');
    expect(currentRule).toContain('box-shadow:');
    expect(currentRule).not.toContain('background:');
  });

  it('covers Phase 36.5 CSS semantics for fills, overlays, and legend swatches (D-03, D-04)', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const currentRule = getCssRule(css, '.physics-paint-roto-cell.current');
    const dirtyRule = getCssRule(css, '.physics-paint-roto-cell.dirty::after');
    const pendingRule = getCssRule(css, '.physics-paint-roto-cell.pending');

    for (const selector of [
      '.physics-paint-roto-cell.roto-fill-empty',
      '.physics-paint-roto-cell.roto-fill-cached',
      '.physics-paint-roto-cell.roto-fill-editable-current',
      '.physics-paint-roto-cell.roto-fill-generated',
      '.physics-paint-roto-cell.roto-fill-background-only',
      '.physics-paint-roto-cell.dirty::after',
      '.physics-paint-roto-cell.pending',
      '.physics-paint-roto-cell.current',
      '.physics-paint-roto-cell-legend',
      '.physics-paint-roto-cell-swatch',
    ]) {
      expect(css).toContain(selector);
    }
    for (const color of ['#4d535a', '#2d6f48', '#a33d73', '#365ed6', '#505860', '#f59e0b']) {
      expect(css.toLowerCase()).toContain(color);
    }
    expect(currentRule).toContain('outline:');
    expect(currentRule).not.toContain('background:');
    expect(dirtyRule).toContain('#f59e0b');
    expect(dirtyRule).toContain('border-top: 5px');
    expect(dirtyRule).toContain('border-left: 5px');
    expect(pendingRule).toContain('border-style: dashed');
    expect(pendingRule).not.toContain('background:');
  });

  it('removes the in-window mode switch while retaining guarded conversion helpers only for explicit flows', () => {
    const code = source();
    const stateActionsIndex = code.indexOf('physics-paint-state-actions');
    const stateActionsBlock = code.slice(stateActionsIndex, stateActionsIndex + 900);
    const confirmIndex = code.indexOf('function confirmDestructiveAction');
    const confirmBlock = code.slice(confirmIndex, confirmIndex + 360);

    expect(stateActionsIndex).toBeGreaterThan(-1);
    expect(stateActionsBlock).not.toContain('Convert Play to Roto</button>');
    expect(stateActionsBlock).not.toContain('Convert Roto to Play</button>');
    expect(code).not.toContain('physics-paint-workflow-tabs');
    expect(code).not.toContain('requestWorkflowModeChange');
    expect(code).not.toContain('onRequestModeChange');
    expect(confirmBlock).toContain('props.onConvertPlayToRoto?.()');
    expect(confirmBlock).toContain('props.onConvertRotoToPlay?.()');
    expect(code).toContain('PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE');
    expect(code).not.toContain('Clear Play canvas range');
  });

  it('shows missing/background-only Roto status through existing compact strip surfaces without new controls', () => {
    const code = source();
    const statusStackBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('confirmation ? ('));
    const rotoMapBlock = getRotoMapBlock(code);

    expect(code).toContain('getMissingRotoFrameStatusLabel');
    expect(code).toContain('rotoMissingFrameStatusKind?: RotoMissingFrameStatusKind | null');
    expect(workflowStateSource()).toContain('Background only on frame ${frame}');
    expect(workflowStateSource()).toContain('Frame ${safeFrame}: transparent missing Roto frame');
    expect(workflowStateSource()).toContain('Frame ${safeFrame}: background only between real Roto keys');
    expect(workflowStateSource()).toContain('Frame ${safeFrame}: background only from current paper setting');
    expect(rotoMapBlock).toContain('vm.ariaLabel');
    expect(rotoMapBlock).toContain('vm.title');
    expect(statusStackBlock).toContain('rotoMissingStatusLabel ?? currentRotoCell.label');

    for (const forbidden of ['missing-frame mode', 'fallback mode', 'Missing frame mode', 'Fallback mode', 'Missing frame tutorial', 'missing-frame-modal', 'missing-frame-toggle']) {
      expect(code).not.toContain(forbidden);
    }
  });

  it('shows Phase 36.9 cached Roto Play Stop transport in the Roto header', () => {
    const code = source();
    const rotoControlsIndex = code.indexOf("props.mode === 'roto'");
    const rotoControlsBlock = code.slice(rotoControlsIndex, rotoControlsIndex + 3200);
    const statusStackBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('confirmation ? ('));

    for (const contract of [
      'rotoCachedPlaybackAvailable?: boolean',
      'rotoCachedPlaybackStatus?: string | null',
      'rotoCachedPlaybackLoop?: boolean',
      'rotoCachedPlaybackFps?: number',
      'projectFps?: number',
      'onToggleRotoPlayback?: () => void',
      'onRotoPlaybackLoopChange?: (loop: boolean) => void',
      'onRotoPlaybackFpsChange?: (fps: number) => void',
      'isRotoCachedPlaybackActive?: boolean',
    ]) {
      expect(code).toContain(contract);
    }
    // Timeline UI reference: Play/Stop is one transport icon slot among navigation controls.
    expect(rotoControlsBlock).toContain('physics-paint-roto-transport');
    expect(rotoControlsBlock).toContain("aria-label={props.isRotoCachedPlaybackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'}");
    expect(rotoControlsBlock).toContain("{props.isRotoCachedPlaybackActive ? <Square size={15} /> : <Play size={15} />}");
    expect(rotoControlsBlock).not.toContain('>Play</button>');
    expect(rotoControlsBlock).toContain('props.onToggleRotoPlayback');
    expect(rotoControlsBlock).toContain('props.rotoCachedPlaybackAvailable');
    expect(rotoControlsBlock).toContain('props.isRotoCachedPlaybackActive');
    expect(code).toContain('aria-label="Loop cached Roto playback"');
    expect(code).toContain('aria-pressed={Boolean(props.rotoCachedPlaybackLoop)}');
    expect(code).toContain('<RotateCcw size={15} />');
    expect(code).toContain('props.onRotoPlaybackLoopChange');
    expect(code).toContain('aria-label="Cached Roto playback frames per second"');
    expect(code).toContain('props.rotoCachedPlaybackFps ?? props.projectFps ?? 1');
    expect(code).toContain('props.onRotoPlaybackFpsChange?.(value)');
    expect(statusStackBlock).toContain('props.rotoCachedPlaybackStatus ? <p class="physics-paint-roto-playback-status">{props.rotoCachedPlaybackStatus}</p> : null');
    expect(statusStackBlock).not.toContain("props.rotoCachedPlaybackStatus ?? 'Missing frames play transparent/background.'");
  });

  it('keeps cached Roto playback as a source-agnostic callback boundary', () => {
    const code = source();
    const studio = studioSource();

    expect(code).not.toContain('useRotoCachedPlayback');
    expect(code).not.toContain('setInterval');
    expect(code).not.toContain('clearInterval');
    expect(code).toContain('onToggleRotoPlayback?: () => void');
    expect(code).toContain('onRotoPlaybackLoopChange?: (loop: boolean) => void');
    expect(code).toContain('onRotoPlaybackFpsChange?: (fps: number) => void');
    expect(studio).toContain('onToggleRotoPlayback={rotoCachedPlayback.toggle}');
    expect(studio).toContain('onRotoPlaybackLoopChange={rotoCachedPlayback.setLoop}');
    expect(studio).toContain('onRotoPlaybackFpsChange={rotoCachedPlayback.updateFps}');
  });

  it('keeps cached Roto playback UI inside existing Preact CSS scope without render or save-all actions', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../physicsPaintStudio.css'), 'utf8');
    const rotoControlsIndex = code.indexOf("props.mode === 'roto'");
    const rotoControlsBlock = code.slice(rotoControlsIndex, rotoControlsIndex + 3200);

    expect(code).not.toMatch(/from ['"]react['"]/);
    expect(code).not.toMatch(/from ['"]lucide-react['"]/);
    expect(code).not.toContain('className=');
    expect(css).toContain('.physics-paint-roto-transport');
    expect(css).toContain('.physics-paint-roto-loop-toggle');
    expect(css).toContain('.physics-paint-roto-fps-control');
    expect(css).toContain('.physics-paint-roto-playback-status');
    expect(rotoControlsBlock).not.toContain('Render all');
    expect(rotoControlsBlock).not.toContain('Save all');
    expect(rotoControlsBlock).not.toContain('Export');
  });

  it('wires D-08/D-09 Studio Roto key utilities through one session result runner', () => {
    const studio = studioSource();
    const adapter = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoKeyUtilities.ts'), 'utf8');

    expect(studio).toContain('useRotoNavigationCoordinator');
    expect(adapter).toContain('const runSessionResult = useCallback(async');
    expect(adapter).toContain('setKeyActionInFlight(true)');
    expect(adapter).toContain('void runSessionResult(session.duplicateKey())');
    expect(adapter).toContain('void runSessionResult(session.insertBlankKey())');
    expect(adapter).toContain('void runSessionResult(session.deleteKey())');
    expect(adapter).toContain('void runSessionResult(session.copyKey())');
    expect(adapter).toContain('void runSessionResult(session.pasteKey())');
    expect(adapter).toContain("case 'saveFrame'");
    expect(adapter).toContain('input.setDirtyFrames(new Set(sourceSession.dirtyFrames.value))');
    expect(studio).toContain('keyActionInFlight={rotoKeyUtilities.keyActionInFlight}');
    expect(studio).toContain('rotoKeyState: { actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null }');
  });

  it('persists D-08/D-09 Roto key utilities through the parent app bridge', () => {
    const studio = studioSource();
    const store = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../stores/physicPaintStore.ts'), 'utf8');
    const bridge = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../lib/physicPaintBridge.ts'), 'utf8');
    const types = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../types/physicPaint.ts'), 'utf8');

    expect(types).toContain("kind: 'replace-roto-key-frames'");
    expect(store).toContain('replaceRotoKeyFrames(payload');
    expect(bridge).toContain('physicPaintStore.replaceRotoKeyFrames(payload)');
    expect(studio).toContain("kind: 'replace-roto-key-frames'");
    expect(studio).toContain('await sendPhysicPaintApplyPayload(payload');
    expect(bridgeTransportSource()).toContain("await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload)");
    expect(studio).toContain('pendingRotoKeyActionMessageRef');
    expect(studio).toContain('buildBlankRotoFrame(canvasWidth, canvasHeight, frame)');
    expect(rotoCanvasFramesSource()).toContain('export function buildBlankRotoFrame');
    expect(studio).toContain("restore.kind === 'blank-real-key'");
    expect(studio).toContain('setCachedRotoReferenceUrl(null);');
    expect(studio).toContain('onionOverlay={onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map');
    expect(studio).toContain('rotoCachedPlayback.stop();');
    expect(studio).toContain("restore.kind === 'load-real-key'");
    expect(studio).toContain('syncKeyFrameLists');
    expect(studio).toContain('cachedRotoFrames: [...frames].sort');
    expect(studio).not.toContain('const localByFrame = new Map(storeCachedFrames.map((frame) => [frame.appFrame, frame]))');
    expect(studio).not.toContain('localByFrame.get(frame) ?? preservedByFrame.get(frame)');
  });

  it('keeps D-06 Paste target eligibility separate from source-only real-key guards', () => {
    const session = rotoSessionSource();
    const pasteIndex = session.indexOf('function pasteKey()');
    const transactionIndex = session.indexOf('function applyTransaction');
    const pasteBlock = session.slice(pasteIndex, transactionIndex);
    const transactionBlock = session.slice(transactionIndex, session.indexOf('function queueSaveBeforeContinuation'));

    expect(pasteIndex).toBeGreaterThan(-1);
    expect(pasteBlock).toContain("return applyTransaction('pasteKey', 'paste')");
    expect(transactionBlock).toContain("operation === 'paste' && !actionState.canPaste");
    expect(transactionBlock).toContain('actionState.pasteDisabledReason');
    expect(transactionBlock).toContain("operation !== 'paste' && !hasRealSource");
    expect(session).toContain('copiedKey.peek()?.cachedFrame ?? null');
    expect(transactionBlock).not.toContain('requireCurrentRealRotoKey()');
    expect(transactionBlock).not.toContain('canUseRotoKeySource');
  });

  it('delegates D-01 through D-10 Roto key transaction layout and restore decisions to the session/controller boundary', () => {
    const studio = studioSource();
    const session = rotoSessionSource();
    const controller = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../roto/physicsPaintRotoKeyController.ts'), 'utf8');

    const adapter = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/useRotoKeyUtilities.ts'), 'utf8');

    expect(studio).not.toContain('deriveRotoKeyUtilityActionState');
    expect(studio).not.toContain('buildRotoKeyUtilityTransaction');
    expect(adapter).toContain('applyRotoKeyUtilityTransactionToLocalState');
    expect(adapter).toContain('const applyTransaction = useCallback');
    expect(adapter).toContain('void input.persistRotoKeyFrameTransaction(effect.transaction).catch');
    expect(adapter).toContain('input.restoreFrame(effect, refreshedCacheFrames)');
    expect(adapter).toContain('let replacedRotoKeys = false');
    expect(adapter).toContain('replacedRotoKeys = true');
    expect(adapter).toContain('if (!replacedRotoKeys) for (const frame of effect.frames)');
    expect(session).toContain('deriveRotoKeyUtilityActionState');
    expect(session).toContain('buildRotoKeyUtilityTransaction');
    expect(session).toContain('transaction.activeRestore');
    expect(studio).not.toContain('duplicateRotoKeyFrame(getRealRotoKeyFramesForStudio(), currentFrame)');
    expect(studio).not.toContain('insertRotoKeyFrame(getRealRotoKeyFramesForStudio(), currentFrame)');
    expect(studio).not.toContain('deleteRotoKeyFrame(getRealRotoKeyFramesForStudio(), currentFrame)');
    expect(studio).not.toContain('replaceRotoKeyFrame(getRealRotoKeyFramesForStudio(), currentFrame)');

    for (const contract of [
      'export type RotoKeyUtilityOperation',
      'export interface RotoKeyUtilityActionState',
      'export interface RotoKeyUtilityTransaction',
      'export function deriveRotoKeyUtilityActionState',
      'export function buildRotoKeyUtilityTransaction',
      'export function applyRotoKeyUtilityTransactionToLocalState',
      'dirty-save-before-action',
      'active-restore-intent',
      'generated-target-cleanup',
      'deleted-frame-cleanup',
    ]) {
      expect(controller).toContain(contract);
    }
  });

  it('keeps Studio at the current useEffect ceiling and rejects key utility orchestration effects', () => {
    const studio = studioSource();
    const effectCount = (studio.match(/useEffect\(/g) ?? []).length;
    const effectBlocks = [...studio.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[[^\]]*\]\);/g)].map((match) => match[1]);

    expect(effectCount).toBeLessThanOrEqual(22);
    expect(studio).toContain('usePhysicsPaintEngineLifecycle({');
    expect(engineLifecycleSource()).toContain('}, [input.canvasKey]);');
    for (const block of effectBlocks) {
      const coordinatesRotoKeyUtilities = /buildRotoKeyUtilityTransaction|applyRotoKeyUtilityTransactionToLocalState|rotoKeyActionInFlight|pendingRotoKeyActionMessageRef|dirty-save-before-action|generatedFrames|deletedFrames|activeRestore/.test(block);
      expect(coordinatesRotoKeyUtilities).toBe(false);
    }
  });
});
