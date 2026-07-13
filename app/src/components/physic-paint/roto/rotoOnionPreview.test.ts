import { describe, expect, it } from 'vitest';
import { getOnionFrameOpacity, getRotoOnionAnchorDisplayFrame, projectRotoOnionPreviewFrames, type RotoOnionFrame } from './rotoOnionPreview';

const frame = (appFrame: number, patch: Partial<RotoOnionFrame> = {}): RotoOnionFrame => ({ frameIndex: 0, appFrame, dataUrl: `frame-${appFrame}`, width: 10, height: 10, ...patch });

describe('rotoOnionPreview', () => {
  it('anchors display frames and preserves depth opacity', () => {
    expect(getRotoOnionAnchorDisplayFrame(frame(3, { displayFrame: 7 }))).toBe(7);
    expect([1, 2, 3, 4].map((distance) => getOnionFrameOpacity(distance))).toEqual([0.5, 0.25, 0.15, 0.15]);
    expect([0, 30, 100].map((opacity) => getOnionFrameOpacity(1, opacity))).toEqual([0, 0.15, 0.5]);
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

  it('uses only surrounding real anchors for compact and distant generated displays', () => {
    const realFrames = [
      frame(0, { source: 'real-key', sourceFrame: 0, displayFrame: 0, dataUrl: 'A' }),
      frame(1, { source: 'real-key', sourceFrame: 1, displayFrame: 3, dataUrl: 'B' }),
      frame(2, { source: 'real-key', sourceFrame: 2, displayFrame: 6, dataUrl: 'C' }),
      frame(3, { source: 'real-key', sourceFrame: 3, displayFrame: 9, dataUrl: 'D' }),
      frame(14, { source: 'real-key', sourceFrame: 14, displayFrame: 14, dataUrl: 'E' }),
      frame(26, { source: 'real-key', sourceFrame: 26, displayFrame: 26, dataUrl: 'F' }),
    ];
    const generatedFrames = [
      frame(1, { source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1 }),
      frame(2, { source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1 }),
      frame(4, { source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2 }),
      frame(5, { source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2 }),
      frame(12, { source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 14 }),
      frame(20, { source: 'generated-interpolation', fromSourceFrame: 14, toSourceFrame: 26 }),
    ];
    const onion = { enabled: true, previous: true, next: true, count: 1, opacity: 50 };
    const anchorsAt = (currentFrame: number) => {
      const generated = generatedFrames.find((frame) => frame.displayFrame === currentFrame || frame.appFrame === currentFrame);
      return projectRotoOnionPreviewFrames({
        currentFrame,
        currentFrameOwnerSourceFrame: generated?.fromSourceFrame,
        isPlaying: false,
        onion,
        launchFrames: [...realFrames, ...generatedFrames],
      }).map((item) => ({ frame: item.frame, dataUrl: item.dataUrl }));
    };

    expect(anchorsAt(3)).toEqual([{ frame: 0, dataUrl: 'A' }, { frame: 6, dataUrl: 'C' }]);
    expect(anchorsAt(1)).toEqual([{ frame: 3, dataUrl: 'B' }]);
    expect(anchorsAt(2)).toEqual([{ frame: 3, dataUrl: 'B' }]);
    expect(anchorsAt(4)).toEqual([{ frame: 0, dataUrl: 'A' }, { frame: 6, dataUrl: 'C' }]);
    expect(anchorsAt(5)).toEqual([{ frame: 0, dataUrl: 'A' }, { frame: 6, dataUrl: 'C' }]);
    expect(anchorsAt(12)).toEqual([{ frame: 6, dataUrl: 'C' }, { frame: 14, dataUrl: 'E' }]);
    expect(anchorsAt(20)).toEqual([{ frame: 9, dataUrl: 'D' }, { frame: 26, dataUrl: 'F' }]);
  });

  it('makes a generated frame traverse onions from its owning real key', () => {
    const realFrames = [
      frame(6, { source: 'real-key', sourceFrame: 6, displayFrame: 6, dataUrl: 'key-6' }),
      frame(13, { source: 'real-key', sourceFrame: 13, displayFrame: 13, dataUrl: 'key-13' }),
      frame(17, { source: 'real-key', sourceFrame: 17, displayFrame: 17, dataUrl: 'key-17' }),
    ];
    const generatedFrame = frame(15, {
      source: 'generated-interpolation',
      sourceFrame: 13,
      fromSourceFrame: 13,
      toSourceFrame: 17,
      displayFrame: 15,
      dataUrl: 'key-13',
    });

    expect(projectRotoOnionPreviewFrames({
      currentFrame: 15,
      currentFrameOwnerSourceFrame: generatedFrame.fromSourceFrame,
      isPlaying: false,
      onion: { enabled: true, previous: true, next: true, count: 1, opacity: 50 },
      launchFrames: [...realFrames, generatedFrame],
    }).map((item) => item.frame)).toEqual([6, 17]);
  });

  it('counts neighboring real keys rather than generated or empty display frames', () => {
    const realFrames = [
      frame(3, { source: 'real-key', sourceFrame: 3, displayFrame: 3, dataUrl: 'key-3' }),
      frame(6, { source: 'real-key', sourceFrame: 6, displayFrame: 6, dataUrl: 'key-6' }),
      frame(13, { source: 'real-key', sourceFrame: 13, displayFrame: 13, dataUrl: 'key-13' }),
      frame(17, { source: 'real-key', sourceFrame: 17, displayFrame: 17, dataUrl: 'key-17' }),
    ];
    const nonKeyPreviews = new Map(
      [7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 20].map((display) => [display, frame(display, { dataUrl: `display-${display}` })]),
    );
    const anchorsAt = (currentFrame: number, count: number) => projectRotoOnionPreviewFrames({
      currentFrame,
      isPlaying: false,
      onion: { enabled: true, previous: true, next: true, count, opacity: 50 },
      launchFrames: realFrames,
      previewFrames: nonKeyPreviews,
    }).map((item) => item.frame);

    for (const display of [7, 8, 9, 10, 11, 12]) {
      expect(anchorsAt(display, 1)).toEqual([6, 13]);
    }
    for (const display of [18, 19, 20]) {
      expect(anchorsAt(display, 1)).toEqual([17]);
      expect(anchorsAt(display, 2)).toEqual([13, 17]);
    }
  });

  it('hides previews during playback and respects direction toggles', () => {
    const input = { currentFrame: 5, onion: { enabled: true, previous: true, next: false, count: 1, opacity: 50 }, launchFrames: [frame(4), frame(6)] };
    expect(projectRotoOnionPreviewFrames({ ...input, isPlaying: true })).toEqual([]);
    expect(projectRotoOnionPreviewFrames({ ...input, isPlaying: false }).map((item) => item.frame)).toEqual([4]);
  });
});
