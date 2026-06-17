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
    expect(code).toContain('Save pending');
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

  it('explains Roto interpolation availability and render-only generated frames', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');

    expect(code).toContain('getRotoInterpolationStatusCopy');
    expect(code).toContain('Interpolation needs two real Roto keys.');
    expect(code).toContain('Generated in-betweens are render-only; connector lines mark interpolation spans.');
    expect(code).toContain('Generated in-betweens stay render-only, not editable targets.');
    expect(code).not.toContain('Generated in-betweens are editable');
    expect(css).toContain('.physics-paint-roto-interpolation-status');
  });

  it('wires Roto interpolation controls to callback props', () => {
    const code = source();
    const rotoControlsBlock = code.slice(code.indexOf('physics-paint-roto-interpolation-controls'), code.indexOf('physics-paint-play-controls'));

    expect(rotoControlsBlock).toContain('props.onRotoInterpolationEnabledChange');
    expect(rotoControlsBlock).toContain('props.onRotoInterpolationCountChange');
    expect(rotoControlsBlock).toContain('props.onRotoInterpolationModeChange');
    expect(rotoControlsBlock).toContain('props.onRotoInterpolationMotionChange');
    expect(rotoControlsBlock).toContain('deform: interpolationDeform > 0 ? 0 : 50');
    expect(rotoControlsBlock).toContain('position: interpolationPosition > 0 ? 0 : 50');
  });

  it('renders visible Roto key utility controls only inside the Roto strip', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const rotoControlsBlock = code.slice(code.indexOf('physics-paint-roto-key-utilities'), code.indexOf('physics-paint-play-controls'));
    const playControlsBlock = code.slice(code.indexOf('physics-paint-play-controls'), code.indexOf('props.mode === \'roto\' ? (', code.indexOf('physics-paint-play-controls')));

    for (const contract of [
      'physics-paint-roto-key-utilities',
      'Duplicate key',
      'Insert frame',
      'Delete frame',
      'Copy frame',
      'Paste frame',
      'onDuplicateRotoKey?: () => void',
      'onInsertRotoFrame?: () => void',
      'onDeleteRotoFrame?: () => void',
      'onCopyRotoFrame?: () => void',
      'onPasteRotoFrame?: () => void',
      'hasCopiedRotoKey?: boolean',
    ]) {
      expect(code).toContain(contract);
    }
    expect(rotoControlsBlock).toContain('disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey}');
    expect(rotoControlsBlock).toContain('disabled={props.ready === false || !currentRotoUtilityTargetIsRealKey || !props.hasCopiedRotoKey}');
    expect(playControlsBlock).not.toContain('physics-paint-roto-key-utilities');
    expect(css).toContain('.physics-paint-roto-key-utilities');
    expect(css).toContain('.physics-paint-roto-key-button');
  });

  it('explains real-key-only utility scope and replace-style Paste behavior', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');

    expect(code).toContain('getRotoKeyUtilityStatusCopy');
    expect(code).toContain('Key utilities require a real Roto key; generated in-betweens are render-only.');
    expect(code).toContain('Paste replaces the current real key; Duplicate, Insert, and Delete ripple real keys only.');
    expect(code).toContain('Paste is ready and replaces the selected real key without changing timing.');
    expect(code).not.toContain('Generated frames can be moved');
    expect(code).not.toContain('Generated frames can be erased');
    expect(css).toContain('.physics-paint-roto-key-status');
  });

  it('renders compact visible Roto interpolation controls only inside the Roto strip', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const rotoControlsBlock = code.slice(code.indexOf('physics-paint-roto-interpolation-controls'), code.indexOf('physics-paint-play-controls'));
    const playControlsBlock = code.slice(code.indexOf('physics-paint-play-controls'), code.indexOf('props.mode === \'roto\' ? (', code.indexOf('physics-paint-play-controls')));

    for (const contract of [
      'physics-paint-roto-interpolation-controls',
      'Interpolation',
      'In-betweens',
      'Duplicate',
      'Blend',
      'Deform',
      'Position',
      'onRotoInterpolationEnabledChange?: (enabled: boolean) => void',
      'onRotoInterpolationCountChange?: (count: number) => void',
      'onRotoInterpolationModeChange?: (mode: NonNullable<RotoInterpolationSettings[\'mode\']>) => void',
      'onRotoInterpolationMotionChange?: (motion: Pick<RotoInterpolationSettings, \'deform\' | \'position\'>) => void',
    ]) {
      expect(code).toContain(contract);
    }
    expect(rotoControlsBlock).toContain('disabled={props.ready === false}');
    expect(playControlsBlock).not.toContain('physics-paint-roto-interpolation-controls');
    expect(css).toContain('.physics-paint-roto-interpolation-controls');
    expect(css).toContain('.physics-paint-roto-interpolation-select');
    expect(css).toContain('.physics-paint-roto-motion-toggle');
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

  it('keeps onion preview overlays in the workflow strip and moves onion controls to the right panel', () => {
    const code = source();
    const panelCode = rightPanelSource();

    for (const label of [
      'onionPreviewFrames',
      'physics-paint-onion-overlay',
      'physics-paint-onion-prev',
      'physics-paint-onion-next',
      'clampOnionCount',
    ]) {
      expect(code).toContain(label);
    }
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

  it('filters onion preview overlays by count, direction toggles, and live preview state', () => {
    const code = source();

    expect(code).toContain('const visibleOnionPreviewFrames = props.isPlaying || !props.onion.enabled');
    expect(code).toContain('frame.distance <= onionCount');
    expect(code).toContain("frame.direction === 'previous' && props.onion.previous");
    expect(code).toContain("frame.direction === 'next' && props.onion.next");
    expect(code).toContain('visibleOnionPreviewFrames.map');
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

  it('uses Save pending/current copy with pending and ready disabled logic (D-10)', () => {
    const code = source();

    expect(code).not.toContain('Save roto frame');
    expect(code).toContain('onSavePendingRotoFrames: () => void');
    expect(code).toContain('rotoSaveInFlight?: boolean');
    expect(code).toContain("hasPendingRotoFrames ? 'Save pending' : 'Save current'");
    expect(code).toContain('disabled={props.ready === false || !hasPendingRotoFrames || props.rotoSaveInFlight}');
    expect(code).toContain('props.onSavePendingRotoFrames');
  });

  it('keeps current Roto CSS as an outline without adding a fourth fill color', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const currentRuleStart = css.indexOf('.physics-paint-roto-cell.current');
    const currentRule = css.slice(currentRuleStart, css.indexOf('}', currentRuleStart));

    expect(css).toContain('.physics-paint-roto-cell.roto-fill-empty');
    expect(css).toContain('.physics-paint-roto-cell.roto-fill-cached-only');
    expect(css).toContain('.physics-paint-roto-cell.roto-fill-editable-session');
    expect(currentRule).toContain('border-color:');
    expect(currentRule).toContain('outline:');
    expect(currentRule).toContain('box-shadow:');
    expect(currentRule).not.toContain('background:');
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

  it('adds cached Roto playback props and a modest Play/Stop transport control without render-all copy', () => {
    const code = source();
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');
    const rotoControlsIndex = code.indexOf("props.mode === 'roto'");
    const rotoControlsBlock = code.slice(rotoControlsIndex, rotoControlsIndex + 2600);

    for (const contract of [
      'rotoCachedPlaybackAvailable?: boolean',
      'rotoCachedPlaybackStatus?: string | null',
      'onToggleRotoPlayback?: () => void',
      'isRotoCachedPlaybackActive?: boolean',
      'physics-paint-roto-transport',
      'aria-label={props.isRotoCachedPlaybackActive ? \'Stop cached Roto playback\' : \'Play cached Roto frames\'}',
    ]) {
      expect(code).toContain(contract);
    }
    expect(rotoControlsBlock).toContain('props.isRotoCachedPlaybackActive ? \'Stop\' : \'Play\'');
    expect(rotoControlsBlock).toContain('props.onToggleRotoPlayback');
    expect(rotoControlsBlock).toContain('props.rotoCachedPlaybackAvailable');
    expect(rotoControlsBlock).toContain('props.rotoCachedPlaybackStatus');
    expect(rotoControlsBlock).toContain('Missing frames play transparent/background');
    expect(rotoControlsBlock).not.toContain('Render all');
    expect(rotoControlsBlock).not.toContain('Save all');
    expect(css).toContain('.physics-paint-roto-transport');
    expect(css).not.toContain('.physics-paint-roto-cell.playing');
    expect(css).not.toContain('.physics-paint-roto-cell.missing-playback');
  });
});
