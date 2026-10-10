import { describe, expect, it } from 'vitest';
import {
  FADE_CURVE_SAMPLES,
  FADE_OUT_FLOOR,
  fadeLoudnessIn,
  fadeLoudnessOut,
  fadeShape,
  sampleFadeCurve,
} from './fadeCurves';

const CURVES = ['linear', 'exponential', 'logarithmic'] as const;

describe('fadeCurves — shape law f(t)', () => {
  it('linear is t, exponential is t^2, logarithmic is sqrt(t), clamped to [0,1]', () => {
    expect(fadeShape(0, 'linear')).toBe(0);
    expect(fadeShape(0.5, 'linear')).toBe(0.5);
    expect(fadeShape(1, 'linear')).toBe(1);

    expect(fadeShape(0, 'exponential')).toBe(0);
    expect(fadeShape(0.5, 'exponential')).toBe(0.25);
    expect(fadeShape(1, 'exponential')).toBe(1);

    expect(fadeShape(0, 'logarithmic')).toBe(0);
    expect(fadeShape(0.5, 'logarithmic')).toBeCloseTo(Math.SQRT1_2, 12);
    expect(fadeShape(1, 'logarithmic')).toBe(1);

    // Out-of-domain t clamps into [0,1].
    expect(fadeShape(-0.5, 'exponential')).toBe(0);
    expect(fadeShape(1.5, 'exponential')).toBe(1);
  });
});

describe('fadeCurves — mirror identity (F1)', () => {
  it('fadeLoudnessIn(t) === fadeLoudnessOut(1-t) for every curve and t', () => {
    for (const curve of CURVES) {
      for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
        expect(fadeLoudnessIn(t, curve)).toBeCloseTo(fadeLoudnessOut(1 - t, curve), 12);
      }
    }
  });

  it('exponential fade-in loudness is 2t - t^2 (fast start / bows over)', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(fadeLoudnessIn(t, 'exponential')).toBeCloseTo(2 * t - t * t, 12);
    }
  });

  it('exponential fade-out loudness is 1 - t^2 (stays high then drops — unchanged user-liked shape)', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(fadeLoudnessOut(t, 'exponential')).toBeCloseTo(1 - t * t, 12);
    }
  });

  it('linear fade-in rises as t and fade-out falls as 1-t', () => {
    expect(fadeLoudnessIn(0.5, 'linear')).toBe(0.5);
    expect(fadeLoudnessOut(0.5, 'linear')).toBe(0.5);
    expect(fadeLoudnessIn(0, 'linear')).toBe(0);
    expect(fadeLoudnessIn(1, 'linear')).toBe(1);
    expect(fadeLoudnessOut(0, 'linear')).toBe(1);
    expect(fadeLoudnessOut(1, 'linear')).toBe(0);
  });

  it('logarithmic fade-in is 1 - sqrt(1-t) and fade-out is 1 - sqrt(t)', () => {
    expect(fadeLoudnessIn(0.5, 'logarithmic')).toBeCloseTo(1 - Math.SQRT1_2, 12);
    expect(fadeLoudnessOut(0.5, 'logarithmic')).toBeCloseTo(1 - Math.SQRT1_2, 12);
  });
});

describe('fadeCurves — sampleFadeCurve for AudioParam scheduling (F3)', () => {
  it('uses the named sample-count constant and returns endpoints matching the ramp targets', () => {
    const samples = sampleFadeCurve('exponential', 'in', 0, 1);
    expect(samples).toBeInstanceOf(Float32Array);
    expect(samples.length).toBe(FADE_CURVE_SAMPLES + 1);
    expect(samples[0]).toBeCloseTo(fadeLoudnessIn(0, 'exponential'), 6);
    expect(samples[samples.length - 1]).toBeCloseTo(fadeLoudnessIn(1, 'exponential'), 6);
  });

  it('fade-out floors at 0.001 so AudioParam never receives a zero edge', () => {
    expect(FADE_OUT_FLOOR).toBe(0.001);
    for (const curve of CURVES) {
      const samples = sampleFadeCurve(curve, 'out', 0, 1);
      for (const value of samples) {
        expect(value).toBeGreaterThanOrEqual(FADE_OUT_FLOOR);
      }
      expect(samples[samples.length - 1]).toBeCloseTo(FADE_OUT_FLOOR, 6);
    }
  });

  it('partial slices sample the remaining loudness (join mid-fade-in)', () => {
    const slice = sampleFadeCurve('exponential', 'in', 0.5, 1);
    expect(slice[0]).toBeCloseTo(fadeLoudnessIn(0.5, 'exponential'), 6);
    expect(slice[slice.length - 1]).toBeCloseTo(1, 6);
  });

  it('optional gain scales the loudness values', () => {
    const samples = sampleFadeCurve('linear', 'in', 0, 1, 0.5);
    expect(samples[0]).toBeCloseTo(0, 6);
    expect(samples[samples.length - 1]).toBeCloseTo(0.5, 6);
  });
});
