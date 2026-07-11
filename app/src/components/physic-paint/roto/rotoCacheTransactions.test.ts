import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import {
  mergeRotoCacheFramesPreservingLaunchRealKeys,
  normalizeCachedRotoRealKeySourceFrame,
  refreshRotoInterpolationCache,
  removeCachedRotoCacheFrame,
  upsertCachedRotoCacheFrame,
} from './rotoCacheTransactions';

function frame(appFrame: number, sourceFrame = appFrame, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: appFrame,
    appFrame,
    sourceFrame,
    displayFrame: appFrame,
    source,
    dataUrl: `${source}-${appFrame}`,
  };
}

describe('rotoCacheTransactions', () => {
  it('normalizes real keys into compact source-frame cache identity', () => {
    const input = { ...frame(11, 4), displayFrame: 11 };

    expect(normalizeCachedRotoRealKeySourceFrame(input)).toEqual({
      ...input,
      appFrame: 4,
      source: 'real-key',
      sourceFrame: 4,
      displayFrame: 4,
    });
    expect(input.appFrame).toBe(11);
  });

  it('upserts by source identity while preserving display position and cache metadata', () => {
    const existing = [frame(0), frame(3, 1), frame(4, 4, 'generated-interpolation')];
    const result = upsertCachedRotoCacheFrame(existing, {
      frameIndex: 9,
      appFrame: 9,
      sourceFrame: 1,
      displayFrame: 6,
      dataUrl: 'replacement',
    }, true, { dataUrl: 'onion' });

    expect(result).toEqual([
      frame(0),
      expect.objectContaining({ appFrame: 4, source: 'generated-interpolation' }),
      expect.objectContaining({
        appFrame: 6,
        sourceFrame: 1,
        displayFrame: 6,
        source: 'real-key',
        dataUrl: 'replacement',
        backgroundOnly: true,
        onionDataUrl: 'onion',
      }),
    ]);
    expect(existing).toHaveLength(3);
  });

  it('removes only the requested display cache frame', () => {
    const existing = [frame(0), frame(3, 1), frame(4, 4, 'generated-interpolation')];

    expect(removeCachedRotoCacheFrame(existing, 3)).toEqual([existing[0], existing[2]]);
    expect(existing).toHaveLength(3);
  });

  it('refreshes enabled interpolation from store display frames and OFF state from real keys only', () => {
    const launchFrames = [frame(0), frame(9, 3)];
    const storeFrames = [frame(0), frame(4, 1), frame(5, 1, 'generated-interpolation')];

    const enabled = refreshRotoInterpolationCache(launchFrames, storeFrames, true);
    expect(enabled.frames).toEqual(storeFrames);
    expect(enabled.realDisplayFrames).toEqual([0, 4]);

    const disabled = refreshRotoInterpolationCache(launchFrames, storeFrames, false);
    expect(disabled.frames).toEqual([storeFrames[0], storeFrames[1]]);
    expect(disabled.realDisplayFrames).toEqual([0, 4]);
    expect(disabled.confirmedRealKeys).toEqual([
      [0, expect.objectContaining({ appFrame: 0, sourceFrame: 0, displayFrame: 0 })],
      [1, expect.objectContaining({ appFrame: 1, sourceFrame: 1, displayFrame: 1 })],
    ]);
  });

  it('falls back to compact launch real keys when the store cache is empty', () => {
    const launchFrames = [frame(0), frame(9, 3), frame(5, 1, 'generated-interpolation')];

    const result = refreshRotoInterpolationCache(launchFrames, [], true);

    expect(result.frames).toEqual([
      expect.objectContaining({ appFrame: 0, sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 3, sourceFrame: 3, displayFrame: 3 }),
    ]);
    expect(result.realDisplayFrames).toEqual([0, 3]);
  });

  it('merges missing launch real keys with store precedence and preserves generated store frames', () => {
    const launchFrames = [frame(0), frame(11, 4), frame(7, 2, 'generated-interpolation')];
    const storeFrames = [frame(3, 1), { ...frame(8, 4), dataUrl: 'store-real' }, frame(5, 1, 'generated-interpolation')];

    expect(mergeRotoCacheFramesPreservingLaunchRealKeys(launchFrames, storeFrames)).toEqual([
      expect.objectContaining({ appFrame: 0, sourceFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, sourceFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, sourceFrame: 4, source: 'real-key', dataUrl: 'store-real' }),
      expect.objectContaining({ appFrame: 5, sourceFrame: 1, source: 'generated-interpolation' }),
    ]);
  });
});
