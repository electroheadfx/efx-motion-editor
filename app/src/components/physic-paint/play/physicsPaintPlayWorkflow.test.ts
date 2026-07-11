import { describe, expect, it } from 'vitest';
import { PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE, getPlayRangeMarker, getPreviewFps } from './physicsPaintPlayWorkflow';

describe('physicsPaintPlayWorkflow', () => {
  it('provides the missing rendered Play output message for Play-to-Roto conversion (D-39)', () => {
    expect(PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE).toBe('Save or regenerate Play output before converting it to roto frames.');
  });


  it('builds a Play range marker without converting or deleting workflow data (D-23, D-24, D-25, D-28)', () => {
    const marker = getPlayRangeMarker(10, 50, 35);

    expect(marker.startFrame).toBe(10);
    expect(marker.endFrame).toBe(59);
    expect(marker.frameCount).toBe(50);
    expect(marker.currentFrame).toBe(35);
    expect(marker.markerRatio).toBeGreaterThan(0);
    expect(marker.markerRatio).toBeLessThan(1);
  });


  it('clamps Play range marker input to existing physics paint frame limits', () => {
    expect(getPlayRangeMarker(10, 50, 5).currentFrame).toBe(10);
    expect(getPlayRangeMarker(10, 50, 999).currentFrame).toBe(59);
    expect(getPlayRangeMarker(10, 0, 10).frameCount).toBe(1);
  });


  it('uses a positive integer preview FPS or falls back to project-safe 24fps (D-07)', () => {
    expect(getPreviewFps(15)).toBe(15);
    expect(getPreviewFps(23.9)).toBe(23);
    expect(getPreviewFps('24')).toBe(24);
    expect(getPreviewFps(0)).toBe(24);
    expect(getPreviewFps('custom')).toBe(24);
  });

});
