import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const rightPanelSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintRightPanel.tsx');
const studioSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintStudio.tsx');
const source = () => readFileSync(sourcePath, 'utf8');
const rightPanelSource = () => readFileSync(rightPanelSourcePath, 'utf8');
const studioSource = () => readFileSync(studioSourcePath, 'utf8');

describe('PhysicsPaintWorkflowStrip source contract', () => {
  it('exports the workflow strip component and props', () => {
    const code = source();

    expect(code).toContain('export interface PhysicsPaintWorkflowStripProps');
    expect(code).toContain('export function PhysicsPaintWorkflowStrip');
  });

  it('renders a locked standalone mode label instead of Roto and Play workflow tabs', () => {
    const code = source();

    expect(code).toContain("props.mode === 'roto' ? 'Roto paint' : 'Play paint'");
    expect(code).toContain('physics-paint-mode-label');
    expect(code).not.toContain('role="tablist"');
    expect(code).not.toContain('role="tab"');
    expect(code).not.toContain('Roto canvas');
    expect(code).not.toContain('Play canvas');
    expect(code).not.toContain('function requestWorkflowModeChange');
    expect(code).not.toContain('onRequestModeChange');
    expect(code).toContain('Save roto frame');
    expect(code).toContain('Save play');
    expect(code).toContain('Stop');
    expect(rightPanelSource()).toContain('Save state');
    expect(rightPanelSource()).toContain('Load state');
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

  it('uses the Play icon as the render/save action and does not render a text Save play button', () => {
    const code = source();
    const playControlsIndex = code.indexOf('physics-paint-play-controls');
    const playControlsBlock = code.slice(playControlsIndex, playControlsIndex + 3600);

    expect(playControlsBlock).toContain("props.playCacheStatus === 'cached' ? 'Play cached preview' : 'Render and save Play'");
    expect(playControlsBlock).toContain('<Play');
    expect(playControlsBlock).toContain('onClick={handlePrimaryAction}');
    expect(playControlsBlock).not.toContain('>Save play</button>');
    expect(playControlsBlock).not.toContain('aria-label="Play preview"');
    expect(code).toContain("import { ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play, Square }");
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
    expect(code).toContain('physics-paint-play-limit-message');
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
});
