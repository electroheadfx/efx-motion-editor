import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const rightPanelSourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintRightPanel.tsx');
const source = () => readFileSync(sourcePath, 'utf8');
const rightPanelSource = () => readFileSync(rightPanelSourcePath, 'utf8');

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

  it('keeps Play lane clicks inspection-only', () => {
    const code = source();
    const inspectIndex = code.indexOf('onInspectPlayFrame');
    const convertIndex = code.indexOf('onConvertPlayToRoto');

    expect(inspectIndex).toBeGreaterThan(-1);
    expect(convertIndex).toBeGreaterThan(-1);
    expect(code).not.toContain('onClearPlayRange');
    expect(code).toContain('handlePlayRangeClick');
    expect(code.slice(code.indexOf('function handlePlayRangeClick'), code.indexOf('function handlePlayRangeClick') + 900)).not.toContain('onConvertPlayToRoto');
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
      'onOnionChange',
    ]) {
      expect(panelCode).toContain(label);
    }
    expect(code).not.toContain('Onion skin controls');
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
    expect(tabListBlock).toContain('onRequestModeChange');
    expect(tabListBlock).not.toContain('onModeChange');
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
