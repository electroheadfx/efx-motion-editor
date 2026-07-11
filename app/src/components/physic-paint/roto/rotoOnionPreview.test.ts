import { describe, expect, it } from 'vitest';
import { getOnionFrameOpacity, getRotoOnionAnchorDisplayFrame, projectRotoOnionPreviewFrames, type RotoOnionFrame } from './rotoOnionPreview';

const frame = (appFrame: number, patch: Partial<RotoOnionFrame> = {}): RotoOnionFrame => ({ frameIndex: 0, appFrame, dataUrl: `frame-${appFrame}`, width: 10, height: 10, ...patch });

describe('rotoOnionPreview', () => {
  it('anchors display frames and preserves depth opacity', () => {
    expect(getRotoOnionAnchorDisplayFrame(frame(3, { displayFrame: 7 }))).toBe(7);
    expect([1, 2, 3, 4].map(getOnionFrameOpacity)).toEqual([0.5, 0.25, 0.15, 0.15]);
  });

  it('filters generated/background frames, prefers dirty previews, and orders farthest first', () => {
    const result = projectRotoOnionPreviewFrames({
      currentFrame: 5,
      isPlaying: false,
      onion: { enabled: true, previous: true, next: true, count: 2, opacity: 50 },
      launchFrames: [frame(1, { source: 'real-key' }), frame(4, { source: 'real-key', onionDataUrl: 'strokes-4' }), frame(6, { source: 'generated-interpolation' }), frame(7, { source: 'real-key', backgroundOnly: true }), frame(8, { source: 'real-key' })],
      storeFrames: [frame(2, { source: 'real-key' })],
      previewFrames: new Map([[4, frame(4, { dataUrl: 'dirty-4' })]]),
      dirtyFrames: new Set([4]),
    });
    expect(result).toEqual([
      { frame: 2, dataUrl: 'frame-2', direction: 'previous', distance: 2, source: 'roto', kind: 'cached-composite' },
      { frame: 4, dataUrl: 'dirty-4', direction: 'previous', distance: 1, source: 'roto', kind: 'stroke-preview' },
      { frame: 8, dataUrl: 'frame-8', direction: 'next', distance: 1, source: 'roto', kind: 'cached-composite' },
    ]);
  });

  it('hides previews during playback and respects direction toggles', () => {
    const input = { currentFrame: 5, onion: { enabled: true, previous: true, next: false, count: 1, opacity: 50 }, launchFrames: [frame(4), frame(6)] };
    expect(projectRotoOnionPreviewFrames({ ...input, isPlaying: true })).toEqual([]);
    expect(projectRotoOnionPreviewFrames({ ...input, isPlaying: false }).map((item) => item.frame)).toEqual([4]);
  });
});
