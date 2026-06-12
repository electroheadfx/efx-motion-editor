import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintWorkflowStrip.tsx');
const source = () => readFileSync(sourcePath, 'utf8');

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
      'Roto frames',
      'Save roto frame',
      'Save play',
      'Play',
      'Stop',
      'Save state',
      'Load state',
      'Preview only — use Save play to publish this range.',
    ]) {
      expect(code).toContain(label);
    }
  });

  it('owns physics-paint-specific timeline rows without importing the main EFX Motion timeline', () => {
    const code = source();

    expect(code).toContain('physics-paint-timeline');
    expect(code).toContain('physics-paint-roto-cell');
    expect(code).toContain('physics-paint-play-range');
    expect(code).toContain('getPlayRangeMarker');
    expect(code).not.toMatch(/from ['"].*Timeline/);
    expect(code).not.toContain('<Timeline');
  });

  it('keeps Play lane clicks inspection-only', () => {
    const code = source();
    const inspectIndex = code.indexOf('onInspectPlayFrame');
    const convertIndex = code.indexOf('onConvertPlayToRoto');
    const clearIndex = code.indexOf('onClearPlayRange');

    expect(inspectIndex).toBeGreaterThan(-1);
    expect(convertIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(-1);
    expect(code).toContain('handlePlayRangeClick');
    expect(code.slice(code.indexOf('function handlePlayRangeClick'), code.indexOf('function handlePlayRangeClick') + 900)).not.toContain('onConvertPlayToRoto');
    expect(code.slice(code.indexOf('function handlePlayRangeClick'), code.indexOf('function handlePlayRangeClick') + 900)).not.toContain('onClearPlayRange');
  });

  it('implements onion controls, preview overlay classes, and preview suppression copy', () => {
    const code = source();

    for (const label of [
      'onionPreviewFrames',
      'physics-paint-onion-overlay',
      'physics-paint-onion-prev',
      'physics-paint-onion-next',
      'Onion skin hidden during preview',
      'clampOnionCount',
    ]) {
      expect(code).toContain(label);
    }
  });

  it('implements destructive confirmation copy and blocks missing Play to Roto frames', () => {
    const code = source();

    for (const label of [
      'Clear Play canvas range',
      'Convert Play to Roto?',
      'Convert Roto to Play?',
      'Cleared roto frame',
      'Save or regenerate Play output before converting it to roto frames.',
      'onConvertPlayToRoto',
      'onConvertRotoToPlay',
    ]) {
      expect(code).toContain(label);
    }
  });
});
