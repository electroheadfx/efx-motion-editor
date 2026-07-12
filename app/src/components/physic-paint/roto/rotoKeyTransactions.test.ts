import { describe, expect, it } from 'vitest';
import { saveRotoRealKeyTransaction, updateRotoInterpolationSettingsTransaction } from './rotoKeyTransactions';
import { createRotoSourceDisplayModel, getRotoDisplayProjection } from './rotoSourceDisplayModel';

describe('rotoKeyTransactions', () => {
  it('derives normal Save current source state without a custom override', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2],
        settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame: 9,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(9);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 9]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 9]);
  });

  it.each([false, true])('preserves absolute far Save identity from interpolation enabled=%s', (enabled) => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2, 3],
        settings: { enabled, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame: 14,
      currentSettings: { enabled, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(14);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
    ]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 3, 14]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, 14]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, 14]);
  });

  it.each([0, 1, 2, 14])('keeps OFF Save frame %i as its absolute source identity', (displayFrame) => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: displayFrame === 0 ? [] : [0, 1].filter((frame) => frame < displayFrame),
        settings: { enabled: false, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame,
      currentSettings: { enabled: false, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(displayFrame);
    expect(transaction.model.realSourceFrames).toContain(displayFrame);
  });

  it('derives Save current source override and interpolation settings outside Studio', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2],
        settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame: 11,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(11);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 11, inBetweenCount: 4 },
    ]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 11]);
  });

  it('derives interpolation toggle status and next current frame without Studio state', () => {
    const transaction = updateRotoInterpolationSettingsTransaction({
      currentFrame: 4,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 15, position: 25 },
      patch: { enabled: false },
      sourceFrameBeforeUpdate: 1,
      storeRotoFrames: [{ source: 'real-key' }, { source: 'generated-interpolation' }],
      refreshedSettings: { enabled: false, inBetweenCount: 2, mode: 'duplicate', deform: 15, position: 25 },
      failureStatus: null,
    });

    expect(transaction.settings).toEqual({ enabled: false, inBetweenCount: 2, mode: 'duplicate', deform: 15, position: 25 });
    expect(transaction.nextCurrentFrame).toBe(1);
    expect(transaction.status).toBe('Generated in-betweens off — real Roto keys only.');
  });

  it('keeps the current display frame when interpolation remains enabled', () => {
    const transaction = updateRotoInterpolationSettingsTransaction({
      currentFrame: 6,
      currentSettings: { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
      patch: { enabled: true, inBetweenCount: 2 },
      sourceFrameBeforeUpdate: null,
      storeRotoFrames: [{ source: 'generated-interpolation' }],
      refreshedSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
      failureStatus: null,
    });

    expect(transaction.nextCurrentFrame).toBe(6);
    expect(transaction.status).toBe('Generated in-betweens on — render-only frames refresh from real keys.');
  });
});
