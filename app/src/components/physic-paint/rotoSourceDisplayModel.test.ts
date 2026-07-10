import { describe, expect, it } from 'vitest';
import {
  createRotoSourceDisplayModel,
  getRotoDisplayProjection,
  resolveRotoRealKeySaveTarget,
  upsertRotoRealKeySource,
  type RotoSourceDisplayModel,
} from './rotoSourceDisplayModel';

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
      sourceFrame: 4,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 4, inBetweenCount: 4 },
    });

    const nextModel = upsertRotoRealKeySource(model, saveTarget);
    expect(nextModel.realSourceFrames).toEqual([0, 1, 2, 4]);
    expect(nextModel.settings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 4, inBetweenCount: 4 },
    ]);
    expect(getRotoDisplayProjection(nextModel).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 11]);
    expect(getRotoDisplayProjection(nextModel, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 4]);
  });

  it('preserves a farther custom source span when toggling display 14 ON and OFF', () => {
    const target = resolveRotoRealKeySaveTarget(baseModel(), 14);
    const model = upsertRotoRealKeySource(baseModel(), target);

    expect(target).toEqual({
      displayFrame: 14,
      sourceFrame: 7,
      previousSegmentOverride: { fromSourceFrame: 2, toSourceFrame: 7, inBetweenCount: 7 },
    });
    expect(model.realSourceFrames).toEqual([0, 1, 2, 7]);
    expect(model.settings.segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 7, inBetweenCount: 7 },
    ]);
    expect(getRotoDisplayProjection(model, { enabled: false }).realKeys.map((key) => key.displayFrame)).toEqual([0, 1, 2, 7]);
    expect(getRotoDisplayProjection(model, { enabled: true }).realKeys.map((key) => key.displayFrame)).toEqual([0, 3, 6, 14]);
    expect(model.realSourceFrames).toEqual([0, 1, 2, 7]);
  });

  it('hydrates to the same projection as a live model with the same source keys and overrides', () => {
    const live = upsertRotoRealKeySource(baseModel(), resolveRotoRealKeySaveTarget(baseModel(), 11));
    const hydrated = createRotoSourceDisplayModel({
      realSourceFrames: [0, 1, 2, 4],
      settings: {
        enabled: true,
        inBetweenCount: 2,
        mode: 'duplicate',
        segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 4, inBetweenCount: 4 }],
      },
    });

    expect(getRotoDisplayProjection(hydrated)).toEqual(getRotoDisplayProjection(live));
  });
});
