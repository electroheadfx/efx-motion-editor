import { describe, expect, it } from 'vitest';
import { annotatePlayFrameStrokes, findCachedPlayFrame, getCachedPlayFramesForRange, getPlayFrameCountFromAssignments, getPlayFrameEditAssignments, normalizePlayWiggle } from './playFrameTransactions';

describe('playFrameTransactions', () => {
  it('round-trips valid stroke frame assignments and ignores invalid values', () => {
    const state = { strokes: [{ playFrame: 2 }, { playFrame: -1 }, {}, { playFrame: 5 }] };
    const assignments = getPlayFrameEditAssignments(state);
    expect([...assignments]).toEqual([[0, 2], [3, 5]]);
    expect(getPlayFrameCountFromAssignments(assignments, 4)).toBe(6);
    expect(annotatePlayFrameStrokes({ strokes: [{}, {}, {}, {}] }, assignments).strokes).toEqual([
      { playFrame: 2 }, {}, {}, { playFrame: 5 },
    ]);
  });

  it('normalizes Play wiggle values to integer percentages', () => {
    expect(normalizePlayWiggle({ strokeDeformation: 120.5, strokePosition: -4 })).toEqual({
      strokeDeformation: 100,
      strokePosition: 0,
    });
  });

  it('looks up latest, launch, then stored frames using the selected range start', () => {
    const context = {
      layerId: 'layer-1', operationId: 'op-1', startFrame: 4, playStartFrame: 10,
      cachedPlayFrames: [{ frameIndex: 1, appFrame: 11, dataUrl: 'launch', width: 1, height: 1 }],
    };
    const latest = [{ frameIndex: 0, appFrame: 10, dataUrl: 'latest', width: 1, height: 1 }];
    const find = (previewFrame: number) => findCachedPlayFrame({
      context,
      currentFrame: 4,
      previewFrame,
      latestFrames: latest,
      getStoredFrame: (_layerId, appFrame) => appFrame === 12 ? { frameIndex: 2, appFrame, dataUrl: 'stored', width: 1, height: 1 } : null,
    });
    expect(find(0)?.dataUrl).toBe('latest');
    expect(find(1)?.dataUrl).toBe('launch');
    expect(find(2)?.dataUrl).toBe('stored');
    expect(getCachedPlayFramesForRange({ frameCount: 3, cacheDirty: false, findFrame: find })?.map((frame) => frame.dataUrl)).toEqual(['latest', 'launch', 'stored']);
    expect(getCachedPlayFramesForRange({ frameCount: 3, cacheDirty: true, findFrame: find })).toBeNull();
  });
});
