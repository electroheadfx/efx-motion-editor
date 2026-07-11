import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { hydrateRotoLaunchContext, type RotoLaunchHydrationStore } from './rotoLaunchHydration';

function frame(appFrame: number, sourceFrame = appFrame, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return { frameIndex: appFrame, appFrame, sourceFrame, displayFrame: appFrame, source, dataUrl: `${source}-${appFrame}` };
}

function context(cachedRotoFrames: PhysicPaintRotoCacheFrame[]): PhysicPaintLaunchContext {
  return {
    operationId: 'launch',
    layerId: 'layer',
    startFrame: 4,
    cachedRotoFrames,
    rotoInterpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
  };
}

function store(overrides: Partial<RotoLaunchHydrationStore> = {}): RotoLaunchHydrationStore {
  return {
    getRealRotoKeyFrames: () => [],
    upsertRealRotoKeyFrame: vi.fn(),
    setRotoInterpolationSettings: vi.fn(),
    getRotoInterpolationSettings: () => ({ enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 }),
    getRotoCacheFrames: () => [],
    ...overrides,
  };
}

describe('rotoLaunchHydration', () => {
  it('returns launch contexts without interpolation settings unchanged', () => {
    const input = { ...context([]), rotoInterpolationSettings: undefined };
    expect(hydrateRotoLaunchContext(input, store())).toBe(input);
  });

  it('seeds only missing real source keys before applying interpolation settings', () => {
    const input = context([frame(0), frame(7, 2), frame(4, 1, 'generated-interpolation')]);
    const target = store({ getRealRotoKeyFrames: () => [0] });

    hydrateRotoLaunchContext(input, target);

    expect(target.upsertRealRotoKeyFrame).toHaveBeenCalledTimes(1);
    expect(target.upsertRealRotoKeyFrame).toHaveBeenCalledWith('layer', 2, input.cachedRotoFrames?.[1], false);
    expect(target.setRotoInterpolationSettings).toHaveBeenCalledWith('layer', input.rotoInterpolationSettings);
  });

  it('uses refreshed store display frames while interpolation remains enabled', () => {
    const storeFrames = [frame(0), frame(3, 1), frame(1, 0, 'generated-interpolation')];
    const result = hydrateRotoLaunchContext(context([frame(0), frame(8, 2)]), store({ getRotoCacheFrames: () => storeFrames }));

    expect(result.cachedRotoFrames).toEqual(storeFrames);
  });

  it('falls back to compact real source keys when refreshed interpolation is disabled', () => {
    const result = hydrateRotoLaunchContext(context([frame(0), frame(8, 2)]), store({
      getRotoInterpolationSettings: () => ({ enabled: false, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 }),
    }));

    expect(result.cachedRotoFrames).toEqual([
      expect.objectContaining({ appFrame: 0, sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 2, sourceFrame: 2, displayFrame: 2 }),
    ]);
    expect(result.rotoInterpolationSettings?.enabled).toBe(false);
  });
});
