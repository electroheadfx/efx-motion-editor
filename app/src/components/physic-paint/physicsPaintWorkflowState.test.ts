import { describe, expect, it } from 'vitest';
import {
  PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE,
  canPasteRotoKeyTarget,
  canUseRotoKeySource,
  clampOnionCount,
  clampOnionOpacity,
  deleteRotoKeyFrame,
  duplicateRotoKeyFrame,
  getActivePrimaryActionLabel,
  getPhysicsPaintEngineStatusTone,
  getPhysicsPaintSourceLabel,
  getPlayRangeMarker,
  getPreviewFps,
  insertRotoKeyFrame,
  getRotoCellFill,
  getRotoCellStateLabel,
  getRotoCellViewModel,
  getRotoMissingFrameStatus,
  getRotoPendingLabel,
  getRotoReplacementSuccessLabel,
  getMissingRotoFrameStatusLabel,
  isPhysicsPaintDevExportEnabled,
  replaceRotoKeyFrame,
  requiresDestructiveConfirmation,
  type RotoCellBaseMeaning,
  type RotoCellFill,
  type RotoCellOverlay,
} from './physicsPaintWorkflowState';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';

describe('physicsPaintWorkflowState', () => {
  it('returns active primary action labels for Roto and Play workflow tabs (D-10, D-11, D-12, D-16)', () => {
    expect(getActivePrimaryActionLabel('roto')).toBe('Save current');
    expect(getActivePrimaryActionLabel('play')).toBe('Save play');
  });

  it('classifies Roto cells with exactly gray, green, and pink semantic fills (D-11 through D-16)', () => {
    const cachedFrames = [
      { frameIndex: 0, appFrame: 5, dataUrl: 'data:image/png;base64,cached-five', source: 'real-key' as const },
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' as const },
    ];
    const editableFrames = [5];

    expect(getRotoCellFill(5, cachedFrames, editableFrames)).toBe('editable-session');
    expect(getRotoCellFill(6, cachedFrames, editableFrames)).toBe('cached-only');
    expect(getRotoCellFill(7, cachedFrames, editableFrames)).toBe('empty');
  });

  it('keeps pending, dirty, and current-frame state out of the Roto semantic fill helper (D-11 through D-16)', () => {
    const allSemanticFills: RotoCellFill[] = ['empty', 'cached-only', 'editable-session'];

    expect(getRotoCellFill(5, [], [5])).toBe('editable-session');
    expect(getRotoPendingLabel(true, false)).toBe('Unsaved changes — click Save current to cache');
    expect(getRotoPendingLabel(true, true)).toBe('Saving current frame…');
    expect(getRotoPendingLabel(true, true, 7)).toBe('Saving frame 7…');
    expect(getRotoPendingLabel(true, true, -1)).toBe('Saving current frame…');
    expect(getRotoPendingLabel(true, true, 1.5)).toBe('Saving current frame…');
    expect(getRotoPendingLabel(false, false)).toBeNull();
    expect(allSemanticFills).not.toContain('dirty' as RotoCellFill);
    expect(allSemanticFills).not.toContain('yellow' as RotoCellFill);
    expect(allSemanticFills).not.toContain('orange' as RotoCellFill);
    expect(allSemanticFills).not.toContain('current' as RotoCellFill);
  });

  it('builds Roto cell view models for empty, cached, editable, generated, and background-only states', () => {
    const cachedFrames: PhysicPaintRotoCacheFrame[] = [
      { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cached-six', source: 'real-key' },
      { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,background-eight', source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 9, dataUrl: 'data:image/png;base64,generated-nine', source: 'generated-interpolation', nearestRealKeyFrame: 6 },
    ];
    const editableFrames = [5];

    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames, editableFrames }).baseMeaning).toBe('empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames, editableFrames }).state).toBe('Empty');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames, editableFrames }).label).toBe('No Roto content on frame 7');
    expect(getRotoCellViewModel({ frame: 7, currentFrame: 5, cachedFrames, editableFrames }).fillClass).toBe('roto-fill-empty');

    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames, editableFrames }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames, editableFrames }).state).toBe('Cached');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames, editableFrames }).label).toBe('Cached frame 6');
    expect(getRotoCellViewModel({ frame: 6, currentFrame: 5, cachedFrames, editableFrames }).fillClass).toBe('roto-fill-cached');

    expect(getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames, editableFrames }).baseMeaning).toBe('editable-current');
    expect(getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames, editableFrames }).overlays).toContain('current');
    expect(getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames, editableFrames }).label).toBe('Frame 5: Current');
    expect(getRotoCellViewModel({ frame: 5, currentFrame: 5, cachedFrames, editableFrames }).fillClass).toBe('roto-fill-editable-current');

    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames, editableFrames }).baseMeaning).toBe('generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames, editableFrames }).label).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames, editableFrames }).fillClass).toBe('roto-fill-generated');
    expect(getRotoCellViewModel({ frame: 9, currentFrame: 5, cachedFrames, editableFrames }).isEditableTarget).toBe(false);

    const realAndGeneratedCollision = [
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,generated-ten', source: 'generated-interpolation' as const, nearestRealKeyFrame: 6 },
      { frameIndex: 0, appFrame: 10, dataUrl: 'data:image/png;base64,real-ten', source: 'real-key' as const },
    ];
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision, editableFrames: [] }).baseMeaning).toBe('cached');
    expect(getRotoCellViewModel({ frame: 10, currentFrame: 10, cachedFrames: realAndGeneratedCollision, editableFrames: [] }).isEditableTarget).toBe(true);

    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).baseMeaning).toBe('background-only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).state).toBe('Background only');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).label).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).title).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).ariaLabel).toBe('Background only on frame 8');
    expect(getRotoCellViewModel({ frame: 8, currentFrame: 5, cachedFrames, editableFrames }).fillClass).toBe('roto-fill-background-only');
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

  it('keeps Roto current, dirty, and pending as overlays separate from base meanings', () => {
    const baseMeanings: RotoCellBaseMeaning[] = ['empty', 'cached', 'editable-current', 'generated', 'background-only'];
    const overlays: RotoCellOverlay[] = ['current', 'dirty', 'pending'];

    const dirtyModel = getRotoCellViewModel({
      frame: 5,
      currentFrame: 5,
      cachedFrames: [],
      editableFrames: [5],
      pendingFrames: [5],
      isSaving: false,
    });
    const pendingModel = getRotoCellViewModel({
      frame: 5,
      currentFrame: 5,
      cachedFrames: [],
      editableFrames: [5],
      pendingFrames: [5],
      isSaving: true,
    });

    expect(dirtyModel.baseMeaning).toBe('editable-current');
    expect(dirtyModel.overlays).toEqual(['current', 'dirty']);
    expect(dirtyModel.label).toBe('Unsaved changes on frame 5');
    expect(pendingModel.baseMeaning).toBe('editable-current');
    expect(pendingModel.overlays).toEqual(['current', 'dirty', 'pending']);
    expect(pendingModel.label).toBe('Saving frame 5...');
    expect(baseMeanings).not.toContain('current' as RotoCellBaseMeaning);
    expect(baseMeanings).not.toContain('dirty' as RotoCellBaseMeaning);
    expect(baseMeanings).not.toContain('pending' as RotoCellBaseMeaning);
    expect(overlays).not.toContain('cached' as RotoCellOverlay);
  });

  it('returns Roto cell labels from base meanings and overlays', () => {
    expect(getRotoCellStateLabel(7, 'empty', [])).toBe('No Roto content on frame 7');
    expect(getRotoCellStateLabel(6, 'cached', [])).toBe('Cached frame 6');
    expect(getRotoCellStateLabel(5, 'editable-current', ['current'])).toBe('Frame 5: Current');
    expect(getRotoCellStateLabel(5, 'editable-current', ['current', 'dirty'])).toBe('Unsaved changes on frame 5');
    expect(getRotoCellStateLabel(5, 'editable-current', ['current', 'dirty', 'pending'])).toBe('Saving frame 5...');
    expect(getRotoCellStateLabel(9, 'generated', [])).toBe('Generated frame 9 (render-only)');
    expect(getRotoCellStateLabel(8, 'background-only', [])).toBe('Background only on frame 8');
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

  it('builds render-only Roto interpolation spans between adjacent real keys', async () => {
    const { getRotoInterpolationSpanFrames } = await import('./physicsPaintWorkflowState');

    expect(getRotoInterpolationSpanFrames([1, 2, 3], { enabled: true, inBetweenCount: 1, mode: 'duplicate' })).toEqual([
      { fromFrame: 1, toFrame: 2, frame: 1.5, ordinal: 1, total: 1, t: 0.5 },
      { fromFrame: 2, toFrame: 3, frame: 2.5, ordinal: 1, total: 1, t: 0.5 },
    ]);
    expect(getRotoInterpolationSpanFrames([1, 2, 3], { enabled: true, inBetweenCount: 2, mode: 'blend' }).map(span => span.frame)).toEqual([
      1 + 1 / 3,
      1 + 2 / 3,
      2 + 1 / 3,
      2 + 2 / 3,
    ]);
    expect(getRotoInterpolationSpanFrames([4], { enabled: true, inBetweenCount: 2, mode: 'blend' })).toEqual([]);
    expect(getRotoInterpolationSpanFrames([1, 1, 3, -2, 2.2], { enabled: true, inBetweenCount: 1, mode: 'blend' }).map(span => span.fromFrame)).toEqual([1]);
  });

  it('finds the nearest real Roto key for generated-only frame opens', async () => {
    const { getNearestRealRotoKeyFrame } = await import('./physicsPaintWorkflowState');

    expect(getNearestRealRotoKeyFrame(5, [1, 10])).toBe(1);
    expect(getNearestRealRotoKeyFrame(8, [1, 10])).toBe(10);
    expect(getNearestRealRotoKeyFrame(8, [])).toBeNull();
  });

  it('keeps Roto key utilities limited to sorted real keys', async () => {
    const {
      deleteRotoKeyFrame,
      duplicateRotoKeyFrame,
      insertRotoKeyFrame,
      replaceRotoKeyFrame,
    } = await import('./physicsPaintWorkflowState');

    expect(duplicateRotoKeyFrame([1, 2, 3], 1)).toEqual({ sourceFrame: 1, targetFrame: 2, frames: [1, 2, 3, 4], shiftedFrames: [2, 3] });
    expect(duplicateRotoKeyFrame([1, 3], 1)).toEqual({ sourceFrame: 1, targetFrame: 2, frames: [1, 2, 4], shiftedFrames: [3] });
    expect(insertRotoKeyFrame([1, 3, 4], 3)).toEqual({ targetFrame: 3, frames: [1, 3, 4, 5], shiftedFrames: [3, 4] });
    expect(deleteRotoKeyFrame([1, 3, 4], 3)).toEqual({ removedFrame: 3, frames: [1, 3], shiftedFrames: [4] });
    expect(replaceRotoKeyFrame([1, 3, 4], 3)).toEqual({ targetFrame: 3, frames: [1, 3, 4], replaced: true });
    expect(replaceRotoKeyFrame([1, 4], 3)).toEqual({ targetFrame: 3, frames: [1, 3, 4], replaced: false });
  });

  it('duplicates a selected real Roto key onto the next frame and shifts later real keys (D-01, D-04)', () => {
    expect(duplicateRotoKeyFrame([1, 3], 1)).toEqual({
      sourceFrame: 1,
      targetFrame: 2,
      frames: [1, 2, 4],
      shiftedFrames: [3],
    });
  });

  it('inserts a blank real Roto key before the selected real key and shifts current/later real keys (D-02, D-04)', () => {
    expect(insertRotoKeyFrame([1, 3, 4], 3)).toEqual({
      targetFrame: 3,
      frames: [1, 3, 4, 5],
      shiftedFrames: [3, 4],
    });
  });

  it('deletes a selected real Roto key, closes the later real-key gap, and may remove the last key (D-03, D-07)', () => {
    expect(deleteRotoKeyFrame([1, 3, 4], 3)).toEqual({
      removedFrame: 3,
      frames: [1, 3],
      shiftedFrames: [4],
    });
    expect(deleteRotoKeyFrame([5], 5)).toEqual({
      removedFrame: 5,
      frames: [],
      shiftedFrames: [],
    });
  });

  it('creates or replaces real Roto keys for paste targets, including empty and existing real frames (D-06)', () => {
    expect(replaceRotoKeyFrame([1, 4], 3)).toEqual({
      targetFrame: 3,
      frames: [1, 3, 4],
      replaced: false,
    });
    expect(replaceRotoKeyFrame([1, 3, 4], 3)).toEqual({
      targetFrame: 3,
      frames: [1, 3, 4],
      replaced: true,
    });
  });

  it('rejects generated, empty, and invalid source frames for source key actions (D-04, D-05)', () => {
    expect(canUseRotoKeySource({ frame: 1, realKeys: [1, 3] })).toBe(true);
    expect(canUseRotoKeySource({ frame: 2, realKeys: [1, 3] })).toBe(false);
    expect(canUseRotoKeySource({ frame: 2, realKeys: [1, 3], generatedFrames: [2] })).toBe(false);
    expect(canUseRotoKeySource({ frame: -1, realKeys: [1, 3] })).toBe(false);
    expect(canUseRotoKeySource({ frame: 1.5, realKeys: [1, 3] })).toBe(false);
  });

  it('allows paste targets on empty, generated, or real non-negative integer frames once a real key is copied (D-06)', () => {
    expect(canPasteRotoKeyTarget({ frame: 1, hasCopiedRealKey: true })).toBe(true);
    expect(canPasteRotoKeyTarget({ frame: 2, hasCopiedRealKey: true, generatedFrames: [2] })).toBe(true);
    expect(canPasteRotoKeyTarget({ frame: 5, hasCopiedRealKey: true })).toBe(true);
    expect(canPasteRotoKeyTarget({ frame: 5, hasCopiedRealKey: false })).toBe(false);
    expect(canPasteRotoKeyTarget({ frame: -1, hasCopiedRealKey: true })).toBe(false);
    expect(canPasteRotoKeyTarget({ frame: 2.5, hasCopiedRealKey: true })).toBe(false);
  });
});
