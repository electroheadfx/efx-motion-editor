import { describe, expect, it } from 'vitest';
import { claimRotoSelectedFrame, saveRotoRealKeyTransaction, updateRotoInterpolationSettingsTransaction } from './rotoKeyTransactions';
import { createRotoSourceDisplayModel, getRotoDisplayProjection } from './rotoSourceDisplayModel';

describe('rotoKeyTransactions', () => {
  it('claims the selected absolute frame without changing key or spacing metadata', () => {
    const settings = {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate' as const,
      deform: 15,
      position: 25,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    };

    const claim = claimRotoSelectedFrame({ selectedFrame: 26, currentSettings: settings });

    expect(claim).toEqual({ sourceFrame: 26, displayFrame: 26, interpolationSettings: settings });
    expect(claim.interpolationSettings).not.toBe(settings);
    expect(claim.interpolationSettings.segmentSpacingOverrides).not.toBe(settings.segmentSpacingOverrides);
    expect(claim).not.toHaveProperty('model');
    expect(claim).not.toHaveProperty('frameMappings');
    expect(claim).not.toHaveProperty('sourceFrameOverride');
    expect(claim).not.toHaveProperty('target');
  });

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

  it('keeps consecutive distant OFF keys absolute and projects the second segment with the global count', () => {
    const settings = { enabled: false, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 };
    const first = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2, 3],
        settings,
      }),
      displayFrame: 14,
      currentSettings: settings,
    });
    const second = saveRotoRealKeyTransaction({
      model: first.model,
      displayFrame: 15,
      currentSettings: first.interpolationSettings,
    });

    expect(second.model.realSourceFrames).toEqual([0, 1, 2, 3, 14, 15]);
    expect(second.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
    ]);
    expect(getRotoDisplayProjection(second.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, 14, 17]);
    expect(getRotoDisplayProjection(second.model, { enabled: true }).generatedFrames
      .filter((frame) => frame.fromSourceFrame === 14 && frame.toSourceFrame === 15)
      .map((frame) => frame.displayFrame)).toEqual([15, 16]);
    expect(getRotoDisplayProjection(second.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, 14, 15]);
  });

  it('keeps independent distant OFF segments at their absolute ON projections', () => {
    const settings = { enabled: false, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 };
    const first = saveRotoRealKeyTransaction({
      model: createRotoSourceDisplayModel({
        realSourceFrames: [0, 1, 2, 3],
        settings,
      }),
      displayFrame: 14,
      currentSettings: settings,
    });
    const second = saveRotoRealKeyTransaction({
      model: first.model,
      displayFrame: 26,
      currentSettings: first.interpolationSettings,
    });

    expect(second.model.realSourceFrames).toEqual([0, 1, 2, 3, 14, 26]);
    expect(second.interpolationSettings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
      { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
    ]);
    expect(getRotoDisplayProjection(second.model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 9, 14, 26]);
    expect(getRotoDisplayProjection(second.model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 3, 14, 26]);
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
