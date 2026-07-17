import { describe, expect, it } from 'vitest';
import {
  clampOnionCount, clampOnionOpacity,
  getPhysicsPaintEngineStatusTone, getRotoCellFill,
  getRotoCellStateLabel, getRotoCellViewModel, getRotoMissingFrameStatus,
  getRotoReplacementSuccessLabel, getMissingRotoFrameStatusLabel,
  isPhysicsPaintDevExportEnabled,
  type RotoCellBaseMeaning, type RotoCellFill, type RotoCellOverlay,
} from './physicsPaintWorkflowPresentation';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';

describe('physicsPaintWorkflowPresentation', () => {

  it('classifies Roto cells with pixel-only gray and green semantic fills', () => {
    const cachedFrames = [
      { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,cached-five', source: 'real-key' as const },
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' as const },
    ];

    expect(getRotoCellFill(5, cachedFrames)).toBe('cached-only');
    expect(getRotoCellFill(6, cachedFrames)).toBe('cached-only');
    expect(getRotoCellFill(7, cachedFrames)).toBe('empty');
  });


  it('keeps current-frame state out of the pixel-only Roto semantic fill helper', () => {
    const allSemanticFills: RotoCellFill[] = ['empty', 'cached-only'];

    expect(getRotoCellFill(5, [])).toBe('empty');
    expect(allSemanticFills).toEqual(['empty', 'cached-only']);
    expect(allSemanticFills).not.toContain('dirty' as RotoCellFill);
    expect(allSemanticFills).not.toContain('current' as RotoCellFill);
  });


  it('builds Roto cell view models for empty, cached, generated, and background-only states', () => {
    const cachedFrames: PhysicPaintRotoCacheFrame[] = [
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' },
      { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,background-eight', source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 9, dataUrl: 'data:image/png;base64,generated-nine', source: 'generated-interpolation', nearestRealKeyFrame: 6 },
    ];

    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).baseMeaning).toBe('empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).state).toBe('Empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).label).toBe('No Roto content on frame 7');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-empty');

    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).state).toBe('Cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).label).toBe('Cached frame 6');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-cached');

    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).baseMeaning).toBe('generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).label).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames }).isEditableTarget).toBe(false);

    const realAndGeneratedCollision = [
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,generated-ten', source: 'generated-interpolation' as const, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,real-ten', source: 'real-key' as const },
    ];
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision }).isEditableTarget).toBe(true);

    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).baseMeaning).toBe('background-only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).state).toBe('Background only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).label).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).title).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).ariaLabel).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames }).fillClass).toBe('roto-fill-background-only');
  });


  it('returns exact UI-SPEC missing Roto frame status copy', () => {
    expect(getRotoMissingFrameStatus({ frame: 12, kind: 'transparent' })).toEqual({
      kind: 'transparent',
      label: 'Frame 12: transparent missing Roto frame',
    });
    expect(getMissingRotoFrameStatusLabel({ frame: 13, kind: 'background-only-interior' })).toBe('Frame 13: background only between real Roto keys');
    expect(getMissingRotoFrameStatusLabel({ frame: 14, kind: 'background-only-dynamic' })).toBe('Frame 14: background only from current paper setting');
    expect(getRotoReplacementSuccessLabel(15)).toBe('Frame 15 saved as a real Roto key');
  });


  it('keeps current, dirty, and pending as overlays separate from pixel-only base meanings', () => {
    const baseMeanings: RotoCellBaseMeaning[] = ['empty', 'cached', 'generated', 'background-only'];
    const overlays: RotoCellOverlay[] = ['current', 'dirty', 'pending'];

    const dirtyModel = getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames: [], pendingFrames: [5], isSaving: false });
    const pendingModel = getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames: [], pendingFrames: [5], isSaving: true });

    expect(dirtyModel.baseMeaning).toBe('empty');
    expect(dirtyModel.overlays).toEqual(['current', 'dirty']);
    expect(dirtyModel.label).toBe('Unsaved changes on frame 5');
    expect(pendingModel.baseMeaning).toBe('empty');
    expect(pendingModel.overlays).toEqual(['current', 'dirty', 'pending']);
    expect(pendingModel.label).toBe('Saving frame 5...');
    expect(baseMeanings).not.toContain('current' as RotoCellBaseMeaning);
    expect(overlays).not.toContain('cached' as RotoCellOverlay);
  });


  it('returns Roto cell labels from pixel-only base meanings and overlays', () => {
    expect(getRotoCellStateLabel(7, 'empty', [])).toBe('No Roto content on frame 7');
    expect(getRotoCellStateLabel(6, 'cached', [])).toBe('Cached frame 6');
    expect(getRotoCellStateLabel(5, 'empty', ['current', 'dirty'])).toBe('Unsaved changes on frame 5');
    expect(getRotoCellStateLabel(9, 'generated', [])).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellStateLabel(8, 'background-only', [])).toBe('Background only on frame 8');
  });




  it('clamps onion-skin frame count to the Phase 36 preview range (D-29, D-30)', () => {
    expect(clampOnionCount(undefined)).toBe(1);
    expect(clampOnionCount(Number.NaN)).toBe(1);
    expect(clampOnionCount(0)).toBe(1);
    expect(clampOnionCount(2.8)).toBe(2);
    expect(clampOnionCount(10)).toBe(3);
  });


  it('clamps onion opacity to the parent Onion Value percentage range', () => {
    expect(clampOnionOpacity(undefined)).toBe(30);
    expect(clampOnionOpacity(Number.NaN)).toBe(30);
    expect(clampOnionOpacity(-1)).toBe(0);
    expect(clampOnionOpacity(0)).toBe(0);
    expect(clampOnionOpacity(42.8)).toBe(42);
    expect(clampOnionOpacity(120)).toBe(100);
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

});
