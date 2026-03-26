import {describe, it, expect} from 'vitest';
import {computeLayerVelocity, isStationary} from './motionBlurEngine';
import type {KeyframeValues} from '../types/layer';

function makeKV(overrides: Partial<KeyframeValues> = {}): KeyframeValues {
  return {
    opacity: 1,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    blur: 0,
    ...overrides,
  };
}

describe('computeLayerVelocity', () => {
  it('returns dx=10 when current.x=110, previous.x=100', () => {
    const v = computeLayerVelocity(makeKV({x: 110}), makeKV({x: 100}));
    expect(v.dx).toBe(10);
  });

  it('returns dy=-5 when current.y=95, previous.y=100', () => {
    const v = computeLayerVelocity(makeKV({y: 95}), makeKV({y: 100}));
    expect(v.dy).toBe(-5);
  });

  it('returns dRotation=15 when current.rotation=30, previous.rotation=15', () => {
    const v = computeLayerVelocity(makeKV({rotation: 30}), makeKV({rotation: 15}));
    expect(v.dRotation).toBe(15);
  });

  it('returns dScale=0.1 when current scaleX/Y differ from previous', () => {
    const v = computeLayerVelocity(
      makeKV({scaleX: 1.1, scaleY: 1.1}),
      makeKV({scaleX: 1.0, scaleY: 1.0}),
    );
    expect(v.dScale).toBeCloseTo(0.1, 5);
  });
});

describe('isStationary', () => {
  it('returns true when all deltas sum below 0.5', () => {
    const v = {dx: 0.1, dy: 0.1, dRotation: 0.1, dScale: 0.1};
    expect(isStationary(v)).toBe(true);
  });

  it('returns false when dx=5 (well above threshold)', () => {
    const v = {dx: 5, dy: 0, dRotation: 0, dScale: 0};
    expect(isStationary(v)).toBe(false);
  });

  it('returns false when dRotation=2 (above threshold)', () => {
    const v = {dx: 0, dy: 0, dRotation: 2, dScale: 0};
    expect(isStationary(v)).toBe(false);
  });
});
