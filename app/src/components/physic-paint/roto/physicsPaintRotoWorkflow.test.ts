import { describe, expect, it } from 'vitest';
import {
  canPasteRotoKeyTarget, canUseRotoKeySource, deleteRotoKeyFrame, duplicateRotoKeyFrame,
  getExpandedRotoRealKeyFrames, getRotoInterpolationSpanFrames, getSourceRotoFrameForDisplayFrame,
  inferRotoSegmentSpacingOverrides, insertRotoKeyFrame, normalizeRotoSegmentSpacingOverrides,
  replaceRotoKeyFrame, resolveRotoFarEmptyDisplaySaveTarget,
} from './physicsPaintRotoWorkflow';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';

describe('physicsPaintRotoWorkflow', () => {
  it('maps source real keys to generated display frames without shifting source storage (UAT Test 8 Setup A)', () => {
    const sourceRealKeys = [0, 1];

    expect(getExpandedRotoRealKeyFrames(sourceRealKeys, { enabled: true, inBetweenCount: 1, mode: 'duplicate' })).toEqual([
      { sourceFrame: 0, frame: 0, displayFrame: 0, kind: 'real-key' },
      { sourceFrame: 0, fromFrame: 0, toFrame: 2, fromSourceFrame: 0, toSourceFrame: 1, sourceFromFrame: 0, sourceToFrame: 1, frame: 1, displayFrame: 1, generatedFrame: 1, ordinal: 1, total: 1, t: 0.5, kind: 'generated-interpolation', mode: 'duplicate', renderOnly: true },
      { sourceFrame: 1, frame: 2, displayFrame: 2, kind: 'real-key' },
    ]);
    expect(sourceRealKeys).toEqual([0, 1]);
  });


  it('maps sparse source real keys to count-based display slots while preserving original coordinates (UAT Test 8 Setup B)', () => {
    const sourceRealKeys = [0, 1, 3];

    expect(getExpandedRotoRealKeyFrames(sourceRealKeys, { enabled: true, inBetweenCount: 2, mode: 'blend' })).toEqual([
      { sourceFrame: 0, frame: 0, displayFrame: 0, kind: 'real-key' },
      { sourceFrame: 0, fromFrame: 0, toFrame: 3, fromSourceFrame: 0, toSourceFrame: 1, sourceFromFrame: 0, sourceToFrame: 1, frame: 1, displayFrame: 1, generatedFrame: 1, ordinal: 1, total: 2, t: 1 / 3, kind: 'generated-interpolation', mode: 'blend', renderOnly: true },
      { sourceFrame: 0, fromFrame: 0, toFrame: 3, fromSourceFrame: 0, toSourceFrame: 1, sourceFromFrame: 0, sourceToFrame: 1, frame: 2, displayFrame: 2, generatedFrame: 2, ordinal: 2, total: 2, t: 2 / 3, kind: 'generated-interpolation', mode: 'blend', renderOnly: true },
      { sourceFrame: 1, frame: 3, displayFrame: 3, kind: 'real-key' },
      { sourceFrame: 1, fromFrame: 3, toFrame: 6, fromSourceFrame: 1, toSourceFrame: 3, sourceFromFrame: 1, sourceToFrame: 3, frame: 4, displayFrame: 4, generatedFrame: 4, ordinal: 1, total: 2, t: 1 / 3, kind: 'generated-interpolation', mode: 'blend', renderOnly: true },
      { sourceFrame: 1, fromFrame: 3, toFrame: 6, fromSourceFrame: 1, toSourceFrame: 3, sourceFromFrame: 1, sourceToFrame: 3, frame: 5, displayFrame: 5, generatedFrame: 5, ordinal: 2, total: 2, t: 2 / 3, kind: 'generated-interpolation', mode: 'blend', renderOnly: true },
      { sourceFrame: 3, frame: 6, displayFrame: 6, kind: 'real-key' },
    ]);
    expect(sourceRealKeys).toEqual([0, 1, 3]);
  });


  it('restores original source real-key layout exactly when interpolation is disabled', () => {
    expect(getExpandedRotoRealKeyFrames([0, 1, 3], { enabled: false, inBetweenCount: 2, mode: 'blend' })).toEqual([
      { sourceFrame: 0, frame: 0, displayFrame: 0, kind: 'real-key' },
      { sourceFrame: 1, frame: 1, displayFrame: 1, kind: 'real-key' },
      { sourceFrame: 3, frame: 3, displayFrame: 3, kind: 'real-key' },
    ]);
    expect(getRotoInterpolationSpanFrames([0, 1, 3], { enabled: false, inBetweenCount: 2, mode: 'blend' })).toEqual([]);
  });


  it('resolves expanded display-frame real keys back to source keys for first toggle-off', () => {
    const settings = { enabled: true, inBetweenCount: 3, mode: 'duplicate' as const };

    expect(getSourceRotoFrameForDisplayFrame(0, [0, 1, 2], settings, 'existing-only')).toBe(0);
    expect(getSourceRotoFrameForDisplayFrame(4, [0, 1, 2], settings, 'existing-only')).toBe(1);
    expect(getSourceRotoFrameForDisplayFrame(8, [0, 1, 2], settings, 'existing-only')).toBe(2);
    expect(getExpandedRotoRealKeyFrames([0, 1, 2], { ...settings, enabled: false }).map((frame) => ({ sourceFrame: frame.sourceFrame, displayFrame: frame.displayFrame }))).toEqual([
      { sourceFrame: 0, displayFrame: 0 },
      { sourceFrame: 1, displayFrame: 1 },
      { sourceFrame: 2, displayFrame: 2 },
    ]);
  });


  it('maps new real keys created while interpolation is enabled to custom-spaced source targets', () => {
    const settings = { enabled: true, inBetweenCount: 3, mode: 'duplicate' as const };

    expect(getSourceRotoFrameForDisplayFrame(12, [0, 1, 2], settings)).toBe(3);
    expect(getSourceRotoFrameForDisplayFrame(29, [0, 1, 2, 3], settings)).toBe(16);
    expect(getSourceRotoFrameForDisplayFrame(21, [0, 1, 2, 3, 4], { ...settings, enabled: false })).toBe(21);
  });


  it('D-01/D-02 infers custom spacing only for distant adjacent source-key gaps', () => {
    expect(inferRotoSegmentSpacingOverrides([0, 1, 2], { enabled: true, inBetweenCount: 2, mode: 'duplicate' })).toEqual([]);
    expect(inferRotoSegmentSpacingOverrides([0, 1, 2, 6], { enabled: true, inBetweenCount: 2, mode: 'duplicate' })).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 },
    ]);
    expect(inferRotoSegmentSpacingOverrides([0, 1, 2, 6], { enabled: false, inBetweenCount: 2, mode: 'duplicate' })).toEqual([]);
  });


  it('D-04 normalizes source-endpoint overrides and rejects malformed or non-adjacent segments', () => {
    expect(normalizeRotoSegmentSpacingOverrides([
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 },
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 3 },
      { fromSourceFrame: 6, toSourceFrame: 2, inBetweenCount: 4 },
      { fromSourceFrame: 0, toSourceFrame: 2, inBetweenCount: 2 },
      { fromSourceFrame: 1, toSourceFrame: 2, inBetweenCount: 1.5 },
      { fromSourceFrame: 2, toSourceFrame: 7, inBetweenCount: PHYSIC_PAINT_MAX_APPLY_FRAMES + 10 },
    ], [0, 1, 2, 6, 7])).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 },
    ]);
  });


  it('D-01 through D-04 maps compact and custom source keys to literal display real-key positions', () => {
    expect(getExpandedRotoRealKeyFrames([0, 1, 2], { enabled: true, inBetweenCount: 2, mode: 'blend' })
      .filter((entry) => entry.kind === 'real-key')
      .map((entry) => ({ sourceFrame: entry.sourceFrame, displayFrame: entry.displayFrame }))).toEqual([
        { sourceFrame: 0, displayFrame: 0 },
        { sourceFrame: 1, displayFrame: 3 },
        { sourceFrame: 2, displayFrame: 6 },
      ]);

    expect(getExpandedRotoRealKeyFrames([0, 1, 2, 6], {
      enabled: true,
      inBetweenCount: 2,
      mode: 'blend',
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
    }).filter((entry) => entry.kind === 'real-key').map((entry) => ({ sourceFrame: entry.sourceFrame, displayFrame: entry.displayFrame }))).toEqual([
      { sourceFrame: 0, displayFrame: 0 },
      { sourceFrame: 1, displayFrame: 3 },
      { sourceFrame: 2, displayFrame: 6 },
      { sourceFrame: 6, displayFrame: 11 },
    ]);

    expect(getExpandedRotoRealKeyFrames([0, 1, 2, 6], { enabled: false, inBetweenCount: 2, mode: 'blend' })
      .filter((entry) => entry.kind === 'real-key')
      .map((entry) => entry.displayFrame)).toEqual([0, 1, 2, 6]);
  });


  it('D-04 preserves custom segment spacing when global interpolation count changes', () => {
    const overrides = [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }];

    expect(getExpandedRotoRealKeyFrames([0, 1, 2, 6], { enabled: true, inBetweenCount: 1, mode: 'blend', segmentSpacingOverrides: overrides })
      .filter((entry) => entry.kind === 'real-key')
      .map((entry) => entry.displayFrame)).toEqual([0, 2, 4, 9]);
    expect(getExpandedRotoRealKeyFrames([0, 1, 2, 6], { enabled: true, inBetweenCount: 3, mode: 'blend', segmentSpacingOverrides: overrides })
      .filter((entry) => entry.kind === 'real-key')
      .map((entry) => entry.displayFrame)).toEqual([0, 4, 8, 13]);
    expect(getRotoInterpolationSpanFrames([0, 1, 2, 6], { enabled: true, inBetweenCount: 3, mode: 'blend', segmentSpacingOverrides: overrides })
      .filter((entry) => entry.fromSourceFrame === 2 && entry.toSourceFrame === 6)
      .map((entry) => entry.displayFrame)).toEqual([9, 10, 11, 12]);
  });


  it('D-03 resolves far empty display saves to custom-spaced source keys and a previous-segment override', () => {
    const target = resolveRotoFarEmptyDisplaySaveTarget(11, [0, 1, 2], { enabled: true, inBetweenCount: 2, mode: 'duplicate' });

    expect(target).toEqual({
      displayFrame: 11,
      sourceFrame: 4,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 4, inBetweenCount: 4 },
    });
    expect(getExpandedRotoRealKeyFrames([0, 1, 2, target.sourceFrame], {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      segmentSpacingOverrides: target.previousSegmentOverride ? [target.previousSegmentOverride] : [],
    }).filter((entry) => entry.kind === 'real-key').map((entry) => entry.displayFrame)).toEqual([0, 3, 6, 11]);
  });


  it('UAT truth table resolves normal and custom display saves from one source/display model', () => {
    const settings = { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const };
    const realDisplays = (sourceKeys: number[], overrides: PhysicPaintRotoSegmentSpacingOverride[] = []) => getExpandedRotoRealKeyFrames(sourceKeys, {
      ...settings,
      segmentSpacingOverrides: overrides,
    }).filter((entry) => entry.kind === 'real-key').map((entry) => entry.displayFrame);
    const offDisplays = (sourceKeys: number[], overrides: PhysicPaintRotoSegmentSpacingOverride[] = []) => getExpandedRotoRealKeyFrames(sourceKeys, {
      ...settings,
      enabled: false,
      segmentSpacingOverrides: overrides,
    }).filter((entry) => entry.kind === 'real-key').map((entry) => entry.displayFrame);

    expect(realDisplays([0, 1, 2])).toEqual([0, 3, 6]);
    expect(offDisplays([0, 1, 2])).toEqual([0, 1, 2]);

    const normalTarget = resolveRotoFarEmptyDisplaySaveTarget(9, [0, 1, 2], settings);
    expect(normalTarget).toEqual({
      displayFrame: 9,
      sourceFrame: 3,
      previousSegmentOverride: null,
    });
    expect(realDisplays([0, 1, 2, normalTarget.sourceFrame])).toEqual([0, 3, 6, 9]);
    expect(offDisplays([0, 1, 2, normalTarget.sourceFrame])).toEqual([0, 1, 2, 3]);

    const customTarget = resolveRotoFarEmptyDisplaySaveTarget(14, [0, 1, 2], settings);
    const customOverrides = customTarget.previousSegmentOverride ? [customTarget.previousSegmentOverride] : [];
    expect(customTarget).toEqual({
      displayFrame: 14,
      sourceFrame: 7,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 7, inBetweenCount: 7 },
    });
    expect(realDisplays([0, 1, 2, customTarget.sourceFrame], customOverrides)).toEqual([0, 3, 6, 14]);
    expect(offDisplays([0, 1, 2, customTarget.sourceFrame], customOverrides)).toEqual([0, 1, 2, 7]);
    expect(realDisplays([0, 1, 2, customTarget.sourceFrame], customOverrides)).toEqual([0, 3, 6, 14]);
  });


  it('UAT far-empty save keeps the new real key at display #14 and preserves custom spacing when interpolation is off', () => {
    const target = resolveRotoFarEmptyDisplaySaveTarget(14, [0, 1, 2, 3], { enabled: true, inBetweenCount: 2, mode: 'duplicate' });

    expect(target).toEqual({
      displayFrame: 14,
      sourceFrame: 5,
      previousSegmentOverride: { fromSourceFrame: 3, toSourceFrame: 5, inBetweenCount: 4 },
    });
    expect(getExpandedRotoRealKeyFrames([0, 1, 2, 3, target.sourceFrame], {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      segmentSpacingOverrides: target.previousSegmentOverride ? [target.previousSegmentOverride] : [],
    }).filter((entry) => entry.kind === 'real-key').map((entry) => entry.displayFrame)).toEqual([0, 3, 6, 9, 14]);
    expect(getRotoInterpolationSpanFrames([0, 1, 2, 3, target.sourceFrame], {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      segmentSpacingOverrides: target.previousSegmentOverride ? [target.previousSegmentOverride] : [],
    }).filter((entry) => entry.fromSourceFrame === 3 && entry.toSourceFrame === 5).map((entry) => entry.displayFrame)).toEqual([10, 11, 12, 13]);
    const disabledEntries = getExpandedRotoRealKeyFrames([0, 1, 2, 3, target.sourceFrame], {
      enabled: false,
      inBetweenCount: 2,
      mode: 'duplicate',
      segmentSpacingOverrides: target.previousSegmentOverride ? [target.previousSegmentOverride] : [],
    });
    expect(disabledEntries.filter((entry) => entry.kind === 'real-key').map((entry) => entry.displayFrame)).toEqual([0, 1, 2, 3, 5]);
    expect(disabledEntries.filter((entry) => entry.kind === 'generated-interpolation')).toEqual([]);
  });


  it('preserves interpolation enabled, count, and accepted mode settings for duplicate/hold and alpha blend', () => {
    expect(getRotoInterpolationSpanFrames([0, 1], { enabled: true, inBetweenCount: 1, mode: 'duplicate' }).map(span => ({
      fromSourceFrame: span.fromSourceFrame,
      toSourceFrame: span.toSourceFrame,
      displayFrame: span.displayFrame,
      generatedFrame: span.generatedFrame,
      mode: span.mode,
      renderOnly: span.renderOnly,
    }))).toEqual([
      { fromSourceFrame: 0, toSourceFrame: 1, displayFrame: 1, generatedFrame: 1, mode: 'duplicate', renderOnly: true },
    ]);
    expect(getRotoInterpolationSpanFrames([0, 1], { enabled: true, inBetweenCount: 1, mode: 'blend' }).map(span => span.mode)).toEqual(['blend']);
  });


  it('finds the nearest real Roto key for generated-only frame opens', async () => {
    const { getNearestRealRotoKeyFrame } = await import('./physicsPaintRotoWorkflow');

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
    } = await import('./physicsPaintRotoWorkflow');

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
