import { describe, expect, it } from 'vitest';
import {
  createRotoSourceDisplayModel,
  getRotoDisplayProjection,
  resolveRotoRealKeySaveTarget,
  upsertRotoRealKeySource,
  type RotoSourceDisplayModel,
} from './rotoSourceDisplayModel';
import { getSourceRotoFrameForDisplayFrame, resolveRotoFarEmptyDisplaySaveTarget } from './physicsPaintRotoWorkflow';

const baseModel = (): RotoSourceDisplayModel => createRotoSourceDisplayModel({
  realSourceFrames: [0, 1, 2],
  settings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
});

describe('rotoSourceDisplayModel', () => {
  it('projects interpolation ON and OFF display cells from one immutable source model', () => {
    const model = baseModel();

    expect(getRotoDisplayProjection(model, { enabled: true }).realKeys.map((key) => ({ sourceFrame: key.sourceFrame, displayFrame: key.displayFrame }))).toEqual([
      { sourceFrame: 0, displayFrame: 0 },
      { sourceFrame: 1, displayFrame: 3 },
      { sourceFrame: 2, displayFrame: 6 },
    ]);
    expect(getRotoDisplayProjection(model, { enabled: false }).realKeys.map((key) => ({ sourceFrame: key.sourceFrame, displayFrame: key.displayFrame }))).toEqual([
      { sourceFrame: 0, displayFrame: 0 },
      { sourceFrame: 1, displayFrame: 1 },
      { sourceFrame: 2, displayFrame: 2 },
    ]);
    expect(model.realSourceFrames).toEqual([0, 1, 2]);
  });

  it('uses the same far-target transaction for Save current and Paste', () => {
    const model = baseModel();
    const saveTarget = resolveRotoRealKeySaveTarget(model, 11);
    const pasteTarget = resolveRotoRealKeySaveTarget(model, 11);

    expect(saveTarget).toEqual(pasteTarget);
    expect(saveTarget).toEqual({
      displayFrame: 11,
      sourceFrame: 11,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 11, inBetweenCount: 4 },
    });

    const nextModel = upsertRotoRealKeySource(model, saveTarget);
    expect(nextModel.realSourceFrames).toEqual([0, 1, 2, 11]);
    expect(nextModel.settings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 11, inBetweenCount: 4 },
    ]);
    expect(getRotoDisplayProjection(nextModel).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 11]);
    expect(getRotoDisplayProjection(nextModel, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 11]);
  });

  it('preserves absolute source identity while toggling a far frame 14 ON and OFF', () => {
    const target = resolveRotoRealKeySaveTarget(baseModel(), 14);
    const model = upsertRotoRealKeySource(baseModel(), target);

    expect(target).toEqual({
      displayFrame: 14,
      sourceFrame: 14,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 14, inBetweenCount: 7 },
    });
    expect(model.realSourceFrames).toEqual([0, 1, 2, 14]);
    expect(model.settings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 14, inBetweenCount: 7 },
    ]);
    expect(getRotoDisplayProjection(model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 14]);
    expect(getRotoDisplayProjection(model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 14]);
    expect(model.realSourceFrames).toEqual([0, 1, 2, 14]);
  });

  it.each([
    { inBetweenCount: 0, positions: [0, 1, 2] },
    { inBetweenCount: 1, positions: [0, 2, 4] },
    { inBetweenCount: 2, positions: [0, 3, 6] },
    { inBetweenCount: 3, positions: [0, 4, 8] },
  ])('projects exactly $inBetweenCount in-betweens between compact real keys', ({ inBetweenCount, positions }) => {
    const model = createRotoSourceDisplayModel({
      realSourceFrames: [0, 1, 2],
      settings: { enabled: true, inBetweenCount, mode: 'duplicate' },
    });

    expect(getRotoDisplayProjection(model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual(positions);
    expect(getRotoDisplayProjection(model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2]);
    expect(model.realSourceFrames).toEqual([0, 1, 2]);
  });

  it('hydrates to the same projection as a live model with the same source keys and overrides', () => {
    const live = upsertRotoRealKeySource(baseModel(), resolveRotoRealKeySaveTarget(baseModel(), 11));
    const hydrated = createRotoSourceDisplayModel({
      realSourceFrames: [0, 1, 2, 11],
      settings: {
        enabled: true,
        inBetweenCount: 2,
        mode: 'duplicate',
        segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 11, inBetweenCount: 4 }],
      },
    });

    expect(getRotoDisplayProjection(hydrated)).toEqual(getRotoDisplayProjection(live));
  });

  it('keeps durable Save identity absolute while display lookup remains projection-only', () => {
    const model = baseModel();
    const settings = { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const };
    const durableTarget = resolveRotoRealKeySaveTarget(model, 11);

    expect(durableTarget).toEqual({
      displayFrame: 11,
      sourceFrame: 11,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 11, inBetweenCount: 4 },
    });
    expect(resolveRotoFarEmptyDisplaySaveTarget(11, model.realSourceFrames, settings).displayFrame).toBe(11);
    expect(getSourceRotoFrameForDisplayFrame(11, model.realSourceFrames, settings)).not.toBe(durableTarget.sourceFrame);
  });
});
