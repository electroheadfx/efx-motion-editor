import { describe, expect, it } from 'vitest';
import {
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  clampOnionCount,
  clampOnionOpacity,
  getActivePrimaryActionLabel,
  getPhysicsPaintEngineStatusTone,
  getPhysicsPaintSourceLabel,
  getPlayRangeMarker,
  getPreviewFps,
  isPhysicsPaintDevExportEnabled,
  requiresDestructiveConfirmation,
} from './physicsPaintWorkflowState';

describe('physicsPaintWorkflowState', () => {
  it('returns active primary action labels for Roto and Play workflow tabs (D-10, D-11, D-12, D-16)', () => {
    expect(getActivePrimaryActionLabel('roto')).toBe('Save roto frame');
    expect(getActivePrimaryActionLabel('play')).toBe('Save play');
  });

  it('returns numbered source labels for the workflow strip header', () => {
    expect(getPhysicsPaintSourceLabel('roto')).toBe('Roto #1');
    expect(getPhysicsPaintSourceLabel('play')).toBe('Play #2');
  });

  it('requires confirmation only for destructive clear and conversion actions (D-34 through D-38)', () => {
    expect(requiresDestructiveConfirmation('clear-active-source', 'roto')).toBe(false);
    expect(requiresDestructiveConfirmation('clear-active-source', 'play')).toBe(true);
    expect(requiresDestructiveConfirmation('convert-play-to-roto', 'roto')).toBe(true);
    expect(requiresDestructiveConfirmation('convert-play-to-roto', 'play')).toBe(true);
    expect(requiresDestructiveConfirmation('convert-roto-to-play', 'roto')).toBe(true);
    expect(requiresDestructiveConfirmation('convert-roto-to-play', 'play')).toBe(true);
  });

  it('provides the missing rendered Play output message for Play-to-Roto conversion (D-39)', () => {
    expect(PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE).toBe('Save or regenerate Play output before converting it to roto frames.');
  });

  it('clamps onion-skin frame count to the Phase 36 preview range (D-29, D-30)', () => {
    expect(clampOnionCount(undefined)).toBe(1);
    expect(clampOnionCount(Number.NaN)).toBe(1);
    expect(clampOnionCount(0)).toBe(1);
    expect(clampOnionCount(2.8)).toBe(2);
    expect(clampOnionCount(10)).toBe(3);
  });

  it('clamps onion opacity to a visible percentage range', () => {
    expect(clampOnionOpacity(undefined)).toBe(60);
    expect(clampOnionOpacity(Number.NaN)).toBe(60);
    expect(clampOnionOpacity(0)).toBe(10);
    expect(clampOnionOpacity(42.8)).toBe(42);
    expect(clampOnionOpacity(120)).toBe(100);
  });

  it('builds a Play range marker without converting or deleting workflow data (D-23, D-24, D-25, D-28)', () => {
    const marker = getPlayRangeMarker(10, 50, 35);

    expect(marker.startFrame).toBe(10);
    expect(marker.endFrame).toBe(59);
    expect(marker.frameCount).toBe(50);
    expect(marker.currentFrame).toBe(35);
    expect(marker.markerRatio).toBeGreaterThan(0);
    expect(marker.markerRatio).toBeLessThan(1);
  });

  it('clamps Play range marker input to existing physics paint frame limits', () => {
    expect(getPlayRangeMarker(10, 50, 5).currentFrame).toBe(10);
    expect(getPlayRangeMarker(10, 50, 999).currentFrame).toBe(59);
    expect(getPlayRangeMarker(10, 0, 10).frameCount).toBe(1);
  });

  it('keeps the engine status tone ready across non-error apply states', () => {
    expect(getPhysicsPaintEngineStatusTone({ ready: true })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'applying' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'success' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, applyStatus: 'error' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: true, error: 'Apply failed' })).toBe('ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: false })).toBe('not-ready');
    expect(getPhysicsPaintEngineStatusTone({ ready: false, error: 'Engine failed' })).toBe('error');
  });

  it('gates dev/debug export to dev mode only (D-18, D-19)', () => {
    expect(isPhysicsPaintDevExportEnabled({ DEV: true })).toBe(true);
    expect(isPhysicsPaintDevExportEnabled({ MODE: 'development' })).toBe(true);
    expect(isPhysicsPaintDevExportEnabled({ DEV: false, MODE: 'production' })).toBe(false);
    expect(isPhysicsPaintDevExportEnabled({})).toBe(false);
  });

  it('uses a positive integer preview FPS or falls back to project-safe 24fps (D-07)', () => {
    expect(getPreviewFps(15)).toBe(15);
    expect(getPreviewFps(23.9)).toBe(23);
    expect(getPreviewFps('24')).toBe(24);
    expect(getPreviewFps(0)).toBe(24);
    expect(getPreviewFps('custom')).toBe(24);
  });
});
