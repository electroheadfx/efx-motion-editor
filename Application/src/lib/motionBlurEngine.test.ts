import {describe, it, expect} from 'vitest';
import {computeLayerVelocity, isStationary, VelocityCache} from './motionBlurEngine';
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

describe('computeLayerVelocity with zero deltas', () => {
  it('returns all zeros when current equals previous', () => {
    const same = makeKV({x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 45});
    const v = computeLayerVelocity(same, same);
    expect(v.dx).toBe(0);
    expect(v.dy).toBe(0);
    expect(v.dRotation).toBe(0);
    expect(v.dScale).toBe(0);
  });
});

describe('isStationary', () => {
  it('returns true when all deltas sum below 0.5', () => {
    const v = {dx: 0.1, dy: 0.1, dRotation: 0.1, dScale: 0.1};
    expect(isStationary(v)).toBe(true);
  });

  it('returns true with velocity {dx: 0.1, dy: 0.1, dRotation: 0.1, dScale: 0.1} (sum=0.4 < 0.5)', () => {
    const v = {dx: 0.1, dy: 0.1, dRotation: 0.1, dScale: 0.1};
    expect(isStationary(v)).toBe(true);
  });

  it('returns false with velocity {dx: 0.3, dy: 0.3, dRotation: 0, dScale: 0} (sum=0.6 >= 0.5)', () => {
    const v = {dx: 0.3, dy: 0.3, dRotation: 0, dScale: 0};
    expect(isStationary(v)).toBe(false);
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

describe('VelocityCache', () => {
  it('returns null for first frame (no previous data)', () => {
    const cache = new VelocityCache();
    const kv = makeKV({x: 100, y: 50});
    const result = cache.computeForLayer('layer-1', kv, 0);
    expect(result).toBeNull();
  });

  it('returns correct velocity for sequential frames', () => {
    const cache = new VelocityCache();
    const frame0 = makeKV({x: 100, y: 50});
    const frame1 = makeKV({x: 110, y: 55});

    cache.computeForLayer('layer-1', frame0, 0);
    const v = cache.computeForLayer('layer-1', frame1, 1);

    expect(v).not.toBeNull();
    expect(v!.dx).toBe(10);
    expect(v!.dy).toBe(5);
  });

  it('invalidates on non-sequential frame (seek: frame 5 then frame 20)', () => {
    const cache = new VelocityCache();
    const kv0 = makeKV({x: 100});
    const kv1 = makeKV({x: 110});
    const kv20 = makeKV({x: 500});

    cache.computeForLayer('layer-1', kv0, 5);
    cache.computeForLayer('layer-1', kv1, 6);
    // Seek to frame 20 — non-sequential, cache should invalidate
    const v = cache.computeForLayer('layer-1', kv20, 20);
    expect(v).toBeNull();
  });

  it('clear() resets all state (returns null after clear)', () => {
    const cache = new VelocityCache();
    const kv0 = makeKV({x: 100});
    const kv1 = makeKV({x: 110});

    cache.computeForLayer('layer-1', kv0, 0);
    cache.computeForLayer('layer-1', kv1, 1);
    // At this point, next sequential call would return a velocity
    cache.clear();

    // After clear, should return null (no previous data)
    const v = cache.computeForLayer('layer-1', makeKV({x: 120}), 2);
    expect(v).toBeNull();
  });
});
