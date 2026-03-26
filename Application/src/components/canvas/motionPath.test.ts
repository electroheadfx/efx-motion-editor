import {describe, it, expect} from 'vitest';
import {sampleMotionDots, hasMotion} from './MotionPath';
import type {Keyframe, KeyframeValues} from '../../types/layer';

/** Helper to create a Keyframe with partial values */
function kf(
  frame: number,
  values: Partial<KeyframeValues> = {},
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear',
): Keyframe {
  return {
    frame,
    easing,
    values: {
      opacity: 1,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      blur: 0,
      ...values,
    },
  };
}

describe('hasMotion', () => {
  it('returns false for fewer than 2 keyframes', () => {
    expect(hasMotion([])).toBe(false);
    expect(hasMotion([kf(0, {x: 10, y: 20})])).toBe(false);
  });

  it('returns false when all keyframes have the same x,y', () => {
    expect(hasMotion([kf(0, {x: 50, y: 50}), kf(10, {x: 50, y: 50})])).toBe(false);
  });

  it('returns true when any keyframe has different x', () => {
    expect(hasMotion([kf(0, {x: 0, y: 50}), kf(10, {x: 100, y: 50})])).toBe(true);
  });

  it('returns true when any keyframe has different y', () => {
    expect(hasMotion([kf(0, {x: 50, y: 0}), kf(10, {x: 50, y: 100})])).toBe(true);
  });
});

describe('sampleMotionDots', () => {
  const canvasW = 1920;
  const canvasH = 1080;

  it('returns empty array for fewer than 2 keyframes', () => {
    expect(sampleMotionDots([], canvasW, canvasH)).toEqual([]);
    expect(sampleMotionDots([kf(0, {x: 10})], canvasW, canvasH)).toEqual([]);
  });

  it('returns correct number of dots for long spans (integer stepping)', () => {
    // Use span >= 30 to get integer stepping
    const keyframes = [kf(0, {x: 0, y: 0}), kf(40, {x: 100, y: 0})];
    const dots = sampleMotionDots(keyframes, canvasW, canvasH);
    // Frames 0 through 40 inclusive = 41 dots
    expect(dots).toHaveLength(41);
  });

  it('correctly converts offset-from-center to project-space', () => {
    const keyframes = [kf(0, {x: -100, y: 50}), kf(1, {x: 200, y: -50})];
    const dots = sampleMotionDots(keyframes, canvasW, canvasH);
    // First dot: x = -100 + 1920/2 = 860, y = 50 + 1080/2 = 590
    expect(dots[0].x).toBe(-100 + canvasW / 2);
    expect(dots[0].y).toBe(50 + canvasH / 2);
    // Last dot: x = 200 + 960 = 1160, y = -50 + 540 = 490
    expect(dots[dots.length - 1].x).toBe(200 + canvasW / 2);
    expect(dots[dots.length - 1].y).toBe(-50 + canvasH / 2);
  });

  it('first dot matches first keyframe, last dot matches last keyframe', () => {
    const keyframes = [kf(0, {x: 10, y: 20}), kf(5, {x: 100, y: 200})];
    const dots = sampleMotionDots(keyframes, canvasW, canvasH);
    expect(dots[0].x).toBe(10 + canvasW / 2);
    expect(dots[0].y).toBe(20 + canvasH / 2);
    expect(dots[dots.length - 1].x).toBe(100 + canvasW / 2);
    expect(dots[dots.length - 1].y).toBe(200 + canvasH / 2);
  });

  it('with linear easing, dots are evenly spaced (long span)', () => {
    // Use span >= 30 to test integer-step even spacing
    const keyframes = [kf(0, {x: 0, y: 0}, 'linear'), kf(40, {x: 400, y: 0}, 'linear')];
    const dots = sampleMotionDots(keyframes, canvasW, canvasH);
    // With linear easing between frame 0 and 40, x should increase by 10 per frame
    const baseX = canvasW / 2;
    for (let i = 0; i <= 40; i++) {
      expect(dots[i].x).toBeCloseTo(baseX + i * 10, 5);
    }
  });

  it('with 3 keyframes, dots cover the full range', () => {
    const keyframes = [
      kf(0, {x: 0, y: 0}, 'linear'),
      kf(5, {x: 50, y: 0}, 'linear'),
      kf(10, {x: 100, y: 0}, 'linear'),
    ];
    const dots = sampleMotionDots(keyframes, canvasW, canvasH);
    // Span=10 < 30, so sub-frame: (10/0.25)+1 = 41 dots
    expect(dots).toHaveLength(41);
    // First dot at x=0+960, last at x=100+960
    expect(dots[0].x).toBe(canvasW / 2);
    expect(dots[dots.length - 1].x).toBe(100 + canvasW / 2);
  });

  describe('sub-frame sampling (UXP-03)', () => {
    it('uses sub-frame steps when span < 30 frames', () => {
      const keyframes = [kf(0, {x: 0, y: 0}), kf(5, {x: 100, y: 0})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      // span=5, step=0.25, so (5/0.25)+1 = 21 dots
      expect(dots.length).toBe(21);
    });

    it('uses integer steps when span >= 30 frames', () => {
      const keyframes = [kf(0, {x: 0, y: 0}), kf(50, {x: 100, y: 0})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      expect(dots.length).toBe(51);
    });

    it('sub-frame dots have integer frame property', () => {
      const keyframes = [kf(0, {x: 0, y: 0}), kf(5, {x: 100, y: 0})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      for (const dot of dots) {
        expect(dot.frame).toBe(Math.round(dot.frame));
      }
    });

    it('first and last dots still match keyframe positions', () => {
      const keyframes = [kf(0, {x: 10, y: 20}), kf(5, {x: 100, y: 200})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      expect(dots[0].x).toBe(10 + canvasW / 2);
      expect(dots[0].y).toBe(20 + canvasH / 2);
      expect(dots[dots.length - 1].x).toBe(100 + canvasW / 2);
      expect(dots[dots.length - 1].y).toBe(200 + canvasH / 2);
    });

    it('boundary: span exactly 29 uses sub-frame', () => {
      const keyframes = [kf(0, {x: 0, y: 0}), kf(29, {x: 100, y: 0})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      expect(dots.length).toBe(Math.floor(29 / 0.25) + 1); // 117
    });

    it('boundary: span exactly 30 uses integer steps', () => {
      const keyframes = [kf(0, {x: 0, y: 0}), kf(30, {x: 100, y: 0})];
      const dots = sampleMotionDots(keyframes, canvasW, canvasH);
      expect(dots.length).toBe(31);
    });
  });
});
