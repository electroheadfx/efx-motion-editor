import {describe, expect, it, vi} from 'vitest';
// previewRenderer pulls paintStore's projectStore wiring at module scope — mock it
// so this pure-helper suite stays free of store side effects (same pattern as
// TimelineRenderer.test.ts).
vi.mock('./previewRenderer', () => ({
  createCanvasGradient: vi.fn(),
}));
import {
  computeVisibleTimelineFrameSpan,
  resolvePhysicPaintCreateSpan,
} from './timelineVisibleSpan';

describe('computeVisibleTimelineFrameSpan (261010-mwy LOCKED law)', () => {
  it('maps zoom 1 / no scroll / 680px viewport to frames 0-10', () => {
    // frameWidth=60, trackArea=600, count=10, inFrame=0
    expect(computeVisibleTimelineFrameSpan({zoom: 1, scrollX: 0, viewportWidth: 680})).toEqual({
      inFrame: 0,
      outFrame: 10,
    });
  });

  it('zoom in shrinks the span (zoom 2 -> 5 frames)', () => {
    // frameWidth=120, trackArea=600, count=5
    expect(computeVisibleTimelineFrameSpan({zoom: 2, scrollX: 0, viewportWidth: 680})).toEqual({
      inFrame: 0,
      outFrame: 5,
    });
  });

  it('scroll moves the window (scrollX 120 -> inFrame 2)', () => {
    // frameWidth=60, inFrame=floor(120/60)=2, count=10
    expect(computeVisibleTimelineFrameSpan({zoom: 1, scrollX: 120, viewportWidth: 680})).toEqual({
      inFrame: 2,
      outFrame: 12,
    });
  });

  it('holds the 1-frame floor when trackArea is empty (viewportWidth == header)', () => {
    // trackArea=0, count=max(1, 0)=1
    expect(computeVisibleTimelineFrameSpan({zoom: 1, scrollX: 0, viewportWidth: 80})).toEqual({
      inFrame: 0,
      outFrame: 1,
    });
  });
});

describe('resolvePhysicPaintCreateSpan (261010-mwy isolation law)', () => {
  const view = {zoom: 1, scrollX: 0, viewportWidth: 680};

  it('returns the isolated range unchanged when isolation is active', () => {
    expect(
      resolvePhysicPaintCreateSpan({
        isolated: {inFrame: 12, outFrame: 24},
        view: {zoom: 3, scrollX: 500, viewportWidth: 200},
      }),
    ).toEqual({inFrame: 12, outFrame: 24});
  });

  it('returns the view span when there is no isolation target', () => {
    // The createFxSequence 100-frame fallback is never an input to this function.
    expect(resolvePhysicPaintCreateSpan({isolated: null, view})).toEqual({
      inFrame: 0,
      outFrame: 10,
    });
  });
});
