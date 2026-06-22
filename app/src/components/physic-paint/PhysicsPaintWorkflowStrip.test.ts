import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const rightPanelSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintRightPanel.tsx');
const studioSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintStudio.tsx');
const workflowStateSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintWorkflowState.ts');
const source = () => readFileSync(sourcePath, 'utf8');
const rightPanelSource = () => readFileSync(rightPanelSourcePath, 'utf8');
const studioSource = () => readFileSync(studioSourcePath, 'utf8');
const workflowStateSource = () => readFileSync(workflowStateSourcePath, 'utf8');

function getRotoControlsBlock(code: string): string {
  return code.slice(code.indexOf("props.mode === 'roto'"), code.indexOf('physics-paint-play-controls'));
}

function getRotoMapBlock(code: string): string {
  return code.slice(code.indexOf('frameCells.map(frame =>'), code.indexOf('interpolationConnectors.map'));
}

function getCssRule(css: string, selector: string): string {
  const ruleStart = css.indexOf(selector);
  expect(ruleStart).toBeGreaterThan(-1);
  return css.slice(ruleStart, css.indexOf('}', ruleStart));
}

describe('PhysicsPaintWorkflowStrip source contract', () => {
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

    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');

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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).not.toContain('getRotoInterpolationStatusCopy');
    expect(rotoControlsBlock).not.toContain('Interpolation needs two real Roto keys.');
    expect(rotoControlsBlock).not.toContain('Generated in-betweens are render-only; connector lines mark interpolation spans.');
    expect(rotoControlsBlock).not.toContain('Generated in-betweens stay render-only, not editable targets.');
    expect(code).not.toContain('Generated in-betweens are editable');
    expect(css).toContain('.physics-paint-roto-interpolation-status');
  });

  it('gates Roto interpolation controls out of the strict Phase 36.3 Roto strip', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).toContain('onRotoInterpolationEnabledChange?: (enabled: boolean) => void');
    expect(code).toContain('onRotoInterpolationCountChange?: (count: number) => void');
    expect(code).toContain('onRotoInterpolationModeChange?: (mode: NonNullable<RotoInterpolationSettings[\'mode\']>) => void');
    expect(code).toContain('onRotoInterpolationMotionChange?: (motion: Pick<RotoInterpolationSettings, \'deform\' | \'position\'>) => void');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('props.onRotoInterpolationEnabledChange');
    expect(rotoControlsBlock).not.toContain('In-betweens');
    expect(rotoControlsBlock).not.toContain('Deform');
    expect(rotoControlsBlock).not.toContain('Position');
  });

  it('renders the Phase 36.7 contextual Roto key utility pill in the timeline lane (D-11, D-12)', () => {
    const code = source();
    const timelineBlock = code.slice(code.indexOf('physics-paint-timeline'), code.indexOf('physics-paint-roto-status-stack'));
    const headerBlock = code.slice(code.indexOf('physics-paint-workflow-header'), code.indexOf('physics-paint-timeline'));

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
    for (const label of ['Insert', 'Dup', 'Copy', 'Paste', 'Delete']) {
      expect(timelineBlock).toContain(`>${label}</button>`);
    }
    expect(headerBlock).not.toContain('physics-paint-roto-key-utilities');
    expect(headerBlock).not.toContain('Duplicate Roto key');
  });

  it('uses native accessible disabled Roto key buttons and scoped feedback (D-12, D-13, D-15)', () => {
    const code = source();
    const timelineBlock = code.slice(code.indexOf('physics-paint-timeline'), code.indexOf('physics-paint-roto-status-stack'));
    const statusBlock = code.slice(code.indexOf('function getRotoKeyUtilityDisabledMessage'), code.indexOf('const updateScrollbar'));

    expect(code).toContain('const isCurrentRealRotoKey');
    expect(code).toContain('const keyUtilitiesDisabledByBusyState');
    expect(code).toContain('const canPasteRotoKey');
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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');

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
  });

  it('does not render compact Roto interpolation controls in the strict Phase 36.3 Roto strip', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).toContain('onRotoInterpolationEnabledChange?: (enabled: boolean) => void');
    expect(code).toContain('onRotoInterpolationCountChange?: (count: number) => void');
    expect(code).toContain('onRotoInterpolationModeChange?: (mode: NonNullable<RotoInterpolationSettings[\'mode\']>) => void');
    expect(code).toContain('onRotoInterpolationMotionChange?: (motion: Pick<RotoInterpolationSettings, \'deform\' | \'position\'>) => void');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('Interpolation');
    expect(rotoControlsBlock).not.toContain('In-betweens');
    expect(rotoControlsBlock).not.toContain('Blend');
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
    expect(studioCode).toContain('wiggle: playWiggle');
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
      'Onion opacity',
      'physics-onion-opacity',
      'onOnionChange',
    ]) {
      expect(panelCode).toContain(label);
    }
    expect(code).not.toContain('Onion skin controls');
  });

  it('filters canvas onion preview overlays by count, direction toggles, and live preview state', () => {
    const code = studioSource();

    expect(code).toContain('const buildOnionPreviewFrames = useCallback');
    expect(code).toContain('const count = clampOnionCount(onion.count)');
    expect(code).toContain('if (distance < 1 || distance > count) return;');
    expect(code).toContain("direction: frame.appFrame < currentFrame ? 'previous' : 'next'");
    expect(code).toContain('onionPreviewFrames.map');
  });

  it('builds canvas onion previews from Roto sources and does not reuse saved Play frames as yellow overlays', () => {
    const code = studioSource();
    const builderIndex = code.indexOf('const buildOnionPreviewFrames = useCallback');
    const builderBlock = code.slice(builderIndex, builderIndex + 1600);
    const savePlayIndex = code.indexOf('const savePlay = useCallback');
    const savePlayBlock = code.slice(savePlayIndex, savePlayIndex + 3600);

    expect(code).toContain('rotoFrameStatesRef');
    expect(code).toContain('rotoPreviewFramesRef');
    expect(code).toContain('snapshotCurrentRotoFrame');
    expect(builderBlock).toContain('rotoPreviewFramesRef.current');
    expect(builderBlock).toContain('physicPaintStore.getFrames');
    expect(builderBlock).toContain("addFrame(frame, 'roto')");
    expect(builderBlock).not.toContain('latestPlayFrames.forEach');
    expect(builderBlock).not.toContain("addFrame(frame, 'play')");
    expect(savePlayBlock).toContain('setLatestPlayFrames(frames)');
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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
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

  it('guards generated Roto cells as render-only before ordinary editable navigation (D-02, D-05)', () => {
    const code = source();
    const rotoMapBlock = getRotoMapBlock(code);

    expect(rotoMapBlock).toContain("vm.baseMeaning === 'generated'");
    expect(rotoMapBlock).toContain('vm.isEditableTarget === false');
    expect(code).toContain('Generated frame {frame} is render-only.');
    expect(rotoMapBlock).toContain('handleRotoCellClick(frame, vm)');
    expect(rotoMapBlock).not.toContain('onNavigateToSyncedFrame(frame)}');
  });

  it('keeps Phase 36.5 Roto cell scope MVP-only without excluded controls (36.5-SCOPE-01, D-01, D-05)', () => {
    const code = source();
    const rotoControlsBlock = getRotoControlsBlock(code);

    expect(code).not.toMatch(/from ['"].*Timeline/);
    expect(code).not.toContain('<Timeline');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-interpolation-controls');
    expect(rotoControlsBlock).not.toContain('In-betweens');
    expect(rotoControlsBlock).not.toContain('Deform');
    expect(rotoControlsBlock).not.toContain('Position');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-key-utilities');
    expect(rotoControlsBlock).not.toContain('Duplicate key');
    expect(rotoControlsBlock).not.toContain('Insert frame');
    expect(rotoControlsBlock).not.toContain('Delete frame');
    expect(rotoControlsBlock).not.toContain('Copy frame');
    expect(rotoControlsBlock).not.toContain('Paste frame');
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-transport');
    expect(rotoControlsBlock).not.toContain('Play cached Roto frames');
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
    const clickHandlerBlock = code.slice(code.indexOf('function handleRotoCellClick'), code.indexOf('function getGeneratedRotoStatus'));
    const statusStackBlock = code.slice(code.indexOf('physics-paint-roto-status-stack'), code.indexOf('confirmation ? ('));

    expect(code).toContain('rotoSavingFrame?: number | null');
    expect(code).toContain('getRotoPendingLabel(hasPendingRotoFrames, Boolean(props.rotoSaveInFlight), props.rotoSavingFrame)');
    expect(studio).toContain('const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null)');
    expect(studio).toContain('setRotoSavingFrame(sourceFrame)');
    expect(studio).toContain('rotoSavingFrame={rotoSavingFrame}');
    expect(studio).toContain('setRotoSavingFrame(null)');
    expect(studio).toContain('setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);\n    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);');
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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const shellRule = getCssRule(css, '.physics-paint-canvas-stack > .demo-canvas-shell');

    expect(shellRule).toContain('height: 100%');
    expect(shellRule).toContain('max-width: 100%');
    expect(css).not.toContain('calc((100vh - 274px) * 1.538)');
  });

  it('keeps current Roto CSS as an outline without adding a fourth fill color', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
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
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
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

  it('keeps cached Roto playback props but hides playback transport from the strict Phase 36.3 Roto strip', () => {
    const code = source();
    const rotoControlsIndex = code.indexOf("props.mode === 'roto'");
    const rotoControlsBlock = code.slice(rotoControlsIndex, rotoControlsIndex + 2200);

    for (const contract of [
      'rotoCachedPlaybackAvailable?: boolean',
      'rotoCachedPlaybackStatus?: string | null',
      'onToggleRotoPlayback?: () => void',
      'isRotoCachedPlaybackActive?: boolean',
    ]) {
      expect(code).toContain(contract);
    }
    expect(rotoControlsBlock).not.toContain('physics-paint-roto-transport');
    expect(rotoControlsBlock).not.toContain('Play cached Roto frames');
    expect(rotoControlsBlock).not.toContain('props.onToggleRotoPlayback');
    expect(rotoControlsBlock).not.toContain('Missing frames play transparent/background');
    expect(rotoControlsBlock).not.toContain('Render all');
    expect(rotoControlsBlock).not.toContain('Save all');
  });

  it('wires D-08/D-09 Studio Roto key utilities through one save-before-action runner', () => {
    const studio = studioSource();

    expect(studio).toContain('const runRotoKeyAction = useCallback(async');
    expect(studio).toContain('setRotoKeyActionInFlight(true)');
    expect(studio).toContain('setApplyMessage(`Saving frame ${sourceFrame} before ${actionLabel}...`)');
    expect(studio).toContain('const payload = await flushRotoFrame(sourceFrame, { force: true })');
    expect(studio).toContain('if (!payload) {');
    expect(studio).toContain('setApplyMessage(`Could not save frame ${sourceFrame}; ${actionLabel} was cancelled.`)');
    expect(studio).toContain('dirtyRotoFramesRef.current.add(sourceFrame)');
    expect(studio).toContain('keyActionInFlight={rotoKeyActionInFlight}');
  });

  it('persists D-08/D-09 Roto key utilities through the parent app bridge', () => {
    const studio = studioSource();
    const store = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../stores/physicPaintStore.ts'), 'utf8');
    const bridge = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../lib/physicPaintBridge.ts'), 'utf8');
    const types = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../types/physicPaint.ts'), 'utf8');

    expect(types).toContain("kind: 'replace-roto-key-frames'");
    expect(store).toContain('replaceRotoKeyFrames(payload');
    expect(bridge).toContain('physicPaintStore.replaceRotoKeyFrames(payload)');
    expect(studio).toContain("kind: 'replace-roto-key-frames'");
    expect(studio).toContain('await sendPhysicPaintApplyPayload(payload');
    expect(studio).toContain('pendingRotoKeyActionMessageRef');
    expect(studio).toContain('buildBlankRotoFrame(canvasWidth, canvasHeight, result.targetFrame)');
    expect(studio).toContain('const localByFrame = new Map(storeCachedFrames.map((frame) => [frame.appFrame, frame]))');
    expect(studio).toContain('const preservedByFrame = new Map((current.cachedRotoFrames ?? []).map((frame) => [frame.appFrame, frame]))');
    expect(studio).toContain('localByFrame.get(frame) ?? preservedByFrame.get(frame)');
  });

  it('keeps D-06 Paste target eligibility separate from source-only real-key guards', () => {
    const studio = studioSource();
    const pasteIndex = studio.indexOf('const pasteRotoFrame = useCallback');
    const nextActionIndex = studio.indexOf('const saveEditableState = useCallback', pasteIndex);
    const pasteBlock = studio.slice(pasteIndex, nextActionIndex);

    expect(pasteIndex).toBeGreaterThan(-1);
    expect(pasteBlock).toContain('canPasteRotoKeyTarget');
    expect(pasteBlock).toContain('replaceRotoKeyFrame(getRealRotoKeyFramesForStudio(), currentFrame)');
    expect(pasteBlock).toContain('physicPaintStore.upsertRealRotoKeyFrame');
    expect(pasteBlock).toContain("return { frames: result.frames, message: `Pasted key to frame ${currentFrame}.` }");
    expect(pasteBlock).not.toContain('requireCurrentRealRotoKey()');
    expect(pasteBlock).not.toContain('canUseRotoKeySource');
  });
});
