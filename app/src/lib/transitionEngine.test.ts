import { describe, it, expect } from 'vitest';
import { computeFadeOpacity, computeSolidFadeAlpha } from './transitionEngine';
import type { Transition } from '../types/sequence';

function makeFade(overrides: Partial<Transition> & { type: Transition['type'] }): Transition {
  return {
    type: overrides.type,
    duration: overrides.duration ?? 12,
    mode: overrides.mode ?? 'transparency',
    color: overrides.color ?? '#000000',
    curve: overrides.curve ?? 'linear',
  };
}

describe('computeFadeOpacity', () => {
  it('returns 0.0 at first frame of linear fade-in', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 12, curve: 'linear' });
    expect(computeFadeOpacity(0, 24, fadeIn, undefined)).toBe(0.0);
  });

  it('returns 0.5 at midpoint of linear fade-in', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 12, curve: 'linear' });
    expect(computeFadeOpacity(6, 24, fadeIn, undefined)).toBe(0.5);
  });

  it('returns 1.0 past fade-in zone', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 12, curve: 'linear' });
    expect(computeFadeOpacity(12, 24, fadeIn, undefined)).toBe(1.0);
  });

  it('returns ~0.5 at midpoint of linear fade-out', () => {
    const fadeOut = makeFade({ type: 'fade-out', duration: 6, curve: 'linear' });
    // totalFrames=24, fade-out zone starts at frame 18 (24-6)
    // frame 20: framesFromEnd = 23 - 20 = 3; t = 3/6 = 0.5
    expect(computeFadeOpacity(20, 24, undefined, fadeOut)).toBeCloseTo(0.5, 5);
  });

  it('returns ~0.167 near end of linear fade-out', () => {
    const fadeOut = makeFade({ type: 'fade-out', duration: 6, curve: 'linear' });
    // frame 23: framesFromEnd = 23 - 23 = 0; t = 0/6 = 0
    // Actually: framesFromEnd = 23 - 23 = 0, t = 0/6 = 0 => opacity ~ 0
    // Let's recalculate: frame 22: framesFromEnd = 23-22 = 1; t = 1/6 ~ 0.167
    expect(computeFadeOpacity(22, 24, undefined, fadeOut)).toBeCloseTo(1 / 6, 2);
  });

  it('computeSolidFadeAlpha returns 1 - computeFadeOpacity for same inputs', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 12, curve: 'linear' });
    const opacity = computeFadeOpacity(3, 24, fadeIn, undefined);
    const solidAlpha = computeSolidFadeAlpha(3, 24, fadeIn, undefined);
    expect(solidAlpha).toBeCloseTo(1.0 - opacity, 10);
  });

  it('returns product of both fades when both fadeIn and fadeOut overlap', () => {
    // fadeIn: duration 20, fadeOut: duration 20, totalFrames 24
    // At frame 10: fadeIn t=10/20=0.5; fadeOut zone starts at 4 (24-20)
    // framesFromEnd = 23-10=13; fadeOut t=13/20=0.65
    // opacity = 0.5 * 0.65 = 0.325
    const fadeIn = makeFade({ type: 'fade-in', duration: 20, curve: 'linear' });
    const fadeOut = makeFade({ type: 'fade-out', duration: 20, curve: 'linear' });
    const result = computeFadeOpacity(10, 24, fadeIn, fadeOut);
    expect(result).toBeCloseTo(0.5 * (13 / 20), 5);
  });

  it('returns non-linear values with ease-in-out curve (uses applyEasing)', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 12, curve: 'ease-in-out' });
    // At midpoint frame 6: t=0.5, ease-in-out at 0.5 = 0.5 (piecewise cubic symmetric)
    const atMid = computeFadeOpacity(6, 24, fadeIn, undefined);
    expect(atMid).toBeCloseTo(0.5, 5);

    // At quarter frame 3: t=0.25, ease-in-out = 4 * 0.25^3 = 4 * 0.015625 = 0.0625
    const atQuarter = computeFadeOpacity(3, 24, fadeIn, undefined);
    expect(atQuarter).toBeCloseTo(0.0625, 5);

    // Verify it's not linear (linear would give 0.25 at frame 3)
    expect(atQuarter).not.toBeCloseTo(0.25, 1);
  });

  it('returns 1.0 when no fades are defined', () => {
    expect(computeFadeOpacity(10, 24, undefined, undefined)).toBe(1.0);
  });

  it('returns 1.0 when duration is 0 (no divide-by-zero)', () => {
    const fadeIn = makeFade({ type: 'fade-in', duration: 0, curve: 'linear' });
    expect(computeFadeOpacity(0, 24, fadeIn, undefined)).toBe(1.0);
  });
});

describe('computeTransitionProgress', () => {
  // NOTE: Import will fail until Plan 01 adds the function.
  // Use dynamic import or `as any` pattern until then.

  it.todo('returns 0 when overlapDuration is 0');
  it.todo('returns 0 at overlapStart frame with linear curve');
  it.todo('returns 0.5 at midpoint of linear overlap');
  it.todo('returns 1.0 at last frame of overlap');
  it.todo('clamps to 0 when globalFrame is before overlapStart');
  it.todo('clamps to 1 when globalFrame is past overlap end');
  it.todo('applies ease-in-out easing to progress value');
});
