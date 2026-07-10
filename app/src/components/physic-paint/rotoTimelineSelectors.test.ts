import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../types/physicPaint';
import { saveRotoRealKeyTransaction } from './rotoKeyTransactions';
import { selectRealCachedRotoFrames, selectRotoTimelineView } from './rotoTimelineSelectors';
import { createRotoTimelineModel } from './useRotoTimelineModel';

function frame(appFrame: number, sourceFrame: number, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: appFrame,
    appFrame,
    sourceFrame,
    displayFrame: appFrame,
    source,
    dataUrl: `data:image/png;base64,${source}-${appFrame}`,
  };
}

describe('rotoTimelineSelectors', () => {
  it('normalizes cached real keys onto their display frames without including generated cells', () => {
    expect(selectRealCachedRotoFrames([
      frame(0, 0),
      { ...frame(3, 1), appFrame: 1, displayFrame: 3 },
      frame(2, 1, 'generated-interpolation'),
    ])).toEqual([
      frame(0, 0),
      { ...frame(3, 1), appFrame: 3, displayFrame: 3 },
    ]);
  });

  it('projects workflow strip Roto cells from source keys and interpolation settings', () => {
    const view = selectRotoTimelineView({
      cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2)],
      currentFrame: 4,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(view.model.realSourceFrames).toEqual([0, 1, 2]);
    expect(view.occupiedRotoFrames).toEqual([0, 3, 6]);
    expect(view.savedRotoFrames).toEqual([
      { frame: 0, saved: true, label: 'Frame 0' },
      { frame: 3, saved: true, label: 'Frame 3' },
      { frame: 6, saved: true, label: 'Frame 6' },
    ]);
    expect(view.currentFrameIsGenerated).toBe(true);
  });

  it('projects disabled interpolation as compact source keys with custom spacing retained', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: selectRotoTimelineView({
        cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2)],
        currentFrame: 11,
        interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
      }).model,
      displayFrame: 11,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });
    const view = selectRotoTimelineView({
      cachedRotoFrames: [frame(0, 0), frame(1, 1), frame(2, 2), frame(4, 4)],
      currentFrame: 4,
      interpolationSettings: {
        enabled: false,
        inBetweenCount: transaction.model.settings.inBetweenCount ?? 1,
        mode: 'duplicate',
        deform: 0,
        position: 0,
        segmentSpacingOverrides: transaction.model.settings.segmentSpacingOverrides?.map((override) => ({ ...override })),
      },
    });

    expect(view.model.realSourceFrames).toEqual([0, 1, 2, 4]);
    expect(view.occupiedRotoFrames).toEqual([0, 1, 2, 4]);
    expect(view.savedRotoFrames.map((marker) => marker.frame)).toEqual([0, 1, 2, 4]);
    expect(view.currentFrameIsGenerated).toBe(false);
  });

  it('exposes a thin Signals/computed adapter over the pure selector', () => {
    const model = createRotoTimelineModel({
      cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2), frame(4, 1, 'generated-interpolation')],
      currentFrame: 4,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(model.occupiedRotoFrames.value).toEqual([0, 3, 6]);
    expect(model.savedRotoFrames.value.map((marker) => marker.frame)).toEqual([0, 3, 6]);
    expect(model.cachedRotoFrames.value.map((cachedFrame) => cachedFrame.appFrame)).toEqual([0, 3, 6, 4]);
    expect(model.currentFrameIsGenerated.value).toBe(true);
  });
});
