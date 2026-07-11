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

    expect(transaction.sourceFrameOverride).toBe(3);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 3]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3]);
  });

  it('derives custom Save current source state for a far display target', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2, 3],
        settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame: 14,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(5);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 5, inBetweenCount: 4 },
    ]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 3, 5]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, 14]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, 5]);
  });

  it('keeps Save current OFF-start targets as source/display frames without custom overrides', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2, 3],
        settings: { enabled: false, inBetweenCount: 2, mode: 'duplicate' },
      }),
      displayFrame: 14,
      currentSettings: { enabled: false, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(transaction.sourceFrameOverride).toBe(14);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 3, 14]);
    expect(getRotoDisplayProjection(transaction.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, 14]);
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

    expect(transaction.sourceFrameOverride).toBe(4);
    expect(transaction.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 4, inBetweenCount: 4 },
    ]);
    expect(transaction.model.realSourceFrames).toEqual([0, 1, 2, 4]);
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
