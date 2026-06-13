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

  it('renders Roto and Play workflow tabs, primary actions, and lane labels', () => {
    const code = source();

    for (const label of [
      'Roto canvas',
      'Play canvas',
      'Save roto frame',
      'Save play',
      'Play',
      'Stop',
      'Save state',
      'Load state',
    ]) {
      expect(code).toContain(label);
    }
  });

  it('owns physics-paint-specific timeline rows without importing the main EFX Motion timeline', () => {
    const code = source();

    expect(code).toContain('physics-paint-timeline');
    expect(code).toContain('physics-paint-roto-cell');
    expect(code).toContain('occupiedRotoFrames');
    expect(code).toContain('isOccupiedFrame');
    expect(code).toContain('physics-paint-play-range');
    expect(code).toContain('getPlayRangeMarker');
    expect(code).not.toMatch(/from ['"].*Timeline/);
    expect(code).not.toContain('<Timeline');
  });

  it('keeps Play lane clicks as local preview without syncing the editor playhead', () => {
    const code = source();
    const previewIndex = code.indexOf('onPreviewPlayFrame');
    const inspectIndex = code.indexOf('onInspectPlayFrame');
    const convertIndex = code.indexOf('onConvertPlayToRoto');
    const clickBlock = code.slice(code.indexOf('function handlePlayRangeClick'), code.indexOf('function handlePlayRangeClick') + 1100);

    expect(previewIndex).toBeGreaterThan(-1);
    expect(inspectIndex).toBeGreaterThan(-1);
    expect(convertIndex).toBeGreaterThan(-1);
    expect(code).not.toContain('onClearPlayRange');
    const previewBlock = code.slice(code.indexOf('function previewPlayFrame'), code.indexOf('function handlePlayRangeClick'));

    expect(code).toContain('handlePlayRangeClick');
    expect(clickBlock).toContain('previewPlayFrame');
    expect(previewBlock).toContain('props.onPreviewPlayFrame');
    expect(clickBlock).not.toContain('onNavigateToSyncedFrame');
    expect(clickBlock).not.toContain('onConvertPlayToRoto');
  });

  it('accepts local Play preview props and renders a separate vertical current preview marker', () => {
    const code = source();

    for (const contract of [
      'currentPreviewFrame?: number',
      'maxPlayFrameCount?: number',
      'maxPlayFrameCountReason?: string',
      'playCacheStatus?:',
      'onPreviewPlayFrame?: (frame: number) => void',
      'physics-paint-play-current-marker',
      'clampedPreviewFrame',
    ]) {
      expect(code).toContain(contract);
    }
    expect(code).not.toContain('physics-paint-play-range-point current');
  });

  it('fits the Play lane to the available width and colors cached ranges distinctly', () => {
    const code = source();

    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'physicsPaintStudio.css'), 'utf8');

    expect(code).toContain('const playPreviewPercent');
    expect(code).toContain('style={{ width: \'100%\', minWidth: \'100%\' }}');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(code).toContain("props.playCacheStatus === 'cached' ? ' cached' : ''");
    expect(code).toContain('physics-paint-play-range-fill${props.playCacheStatus');
  });

  it('does not render a standalone Play preview button in Play canvas mode', () => {
    const code = source();
    const playControlsIndex = code.indexOf('physics-paint-play-controls');
    const playControlsBlock = code.slice(playControlsIndex, playControlsIndex + 1200);

    expect(playControlsBlock).not.toContain('aria-label="Play preview"');
    expect(playControlsBlock).not.toContain('<Play');
    expect(code).not.toContain("import { ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play, Square }");
  });

  it('uses local Play preview navigation for Play canvas transport buttons', () => {
    const code = source();
    const playControlsIndex = code.indexOf('physics-paint-play-controls');
    const playControlsBlock = code.slice(playControlsIndex, playControlsIndex + 1400);

    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(0)}');
    expect(playControlsBlock).toContain('onClick={() => previewPlayFrame(Math.max(0, clampedPreviewFrame - 1))}');
    expect(playControlsBlock).not.toContain('props.onGoToFirstFrame');
    expect(playControlsBlock).not.toContain('props.onGoToPreviousFrame');
  });

  it('clamps Play frame count input to maxPlayFrameCount and renders max duration messaging', () => {
    const code = source();
    const inputBlock = code.slice(code.indexOf('function handleFrameCountInput'), code.indexOf('function handlePlayRangeClick'));

    expect(inputBlock).toContain('getMaxFrameCount');
    expect(code).toContain('Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, props.maxPlayFrameCount)');
    expect(code).toContain('Play duration limited to');
    expect(code).toContain('props.maxPlayFrameCountReason');
    expect(code).toContain('physics-paint-play-limit-message');
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
      'TOOL OPTIONS',
      'ONION SETTINGS',
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
    const savePlayBlock = code.slice(savePlayIndex, savePlayIndex + 2200);

    expect(code).toContain('rotoFrameStatesRef');
    expect(code).toContain('rotoPreviewFramesRef');
    expect(code).toContain('snapshotCurrentRotoFrame');
    expect(builderBlock).toContain('rotoPreviewFramesRef.current');
    expect(builderBlock).toContain('physicPaintStore.getFrames');
    expect(builderBlock).toContain("addFrame(frame, 'roto')");
    expect(builderBlock).not.toContain('latestPlayFrames.forEach');
    expect(builderBlock).not.toContain("addFrame(frame, 'play')");
    expect(savePlayBlock).not.toContain('setLatestPlayFrames(frames);');
    expect(savePlayBlock).toContain('setLatestPlayFrames([]);');
  });

  it('uses workflow tabs as the guarded conversion affordance without standalone conversion buttons', () => {
    const code = source();
    const stateActionsIndex = code.indexOf('physics-paint-state-actions');
    const stateActionsBlock = code.slice(stateActionsIndex, stateActionsIndex + 900);
    const tabListIndex = code.indexOf('physics-paint-workflow-tabs');
    const tabListBlock = code.slice(tabListIndex, tabListIndex + 900);
    const confirmIndex = code.indexOf('function confirmDestructiveAction');
    const confirmBlock = code.slice(confirmIndex, confirmIndex + 360);

    expect(stateActionsIndex).toBeGreaterThan(-1);
    expect(stateActionsBlock).not.toContain('Convert Play to Roto</button>');
    expect(stateActionsBlock).not.toContain('Convert Roto to Play</button>');
    expect(tabListBlock).toContain('requestWorkflowModeChange');
    expect(tabListBlock).not.toContain('onModeChange');
    expect(code).toContain('onRequestModeChange');
    expect(code).toContain('function requestWorkflowModeChange');
    expect(code).toContain("if (targetMode === props.mode) return");
    expect(code).toContain("setConfirmation('convert-play-to-roto')");
    expect(code).toContain("setConfirmation('convert-roto-to-play')");
    expect(confirmBlock).toContain('props.onConvertPlayToRoto?.()');
    expect(confirmBlock).toContain('props.onConvertRotoToPlay?.()');
    expect(code).toContain('PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE');
    expect(code).not.toContain('Clear Play canvas range');
  });
});
