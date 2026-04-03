import { describe, it, expect } from 'vitest';
import { interpolateAt, applyEasing, lerpValues, extractKeyframeValues } from './keyframeEngine';
import type { Keyframe, KeyframeValues, Layer } from '../types/layer';

/** Helper to create a Keyframe with partial values (defaults to zero) */
function kf(frame: number, values: Partial<KeyframeValues> = {}, easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'linear'): Keyframe {
  return {
    frame,
    easing,
    values: {
      opacity: 0,
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

describe('interpolateAt', () => {
  it('returns null for empty keyframes array', () => {
    expect(interpolateAt([], 5)).toBeNull();
  });

  it('returns exact values for single keyframe on frame', () => {
    const k = kf(0, { opacity: 0.8 });
    const result = interpolateAt([k], 0);
    expect(result).not.toBeNull();
    expect(result!.opacity).toBe(0.8);
  });

  it('returns single keyframe values after last (hold last)', () => {
    const k = kf(0, { opacity: 0.8 });
    const result = interpolateAt([k], 10);
    expect(result).not.toBeNull();
    expect(result!.opacity).toBe(0.8);
  });

  it('returns first keyframe values before first (hold first)', () => {
    const k0 = kf(0, { opacity: 0.2 });
    const k1 = kf(10, { opacity: 1 });
    const result = interpolateAt([k0, k1], -5);
    expect(result).not.toBeNull();
    expect(result!.opacity).toBe(0.2);
  });

  it('returns last keyframe values after last', () => {
    const k0 = kf(0, { opacity: 0.2 });
    const k1 = kf(10, { opacity: 1 });
    const result = interpolateAt([k0, k1], 15);
    expect(result).not.toBeNull();
    expect(result!.opacity).toBe(1);
  });

  it('interpolates midpoint linear correctly', () => {
    const k0 = kf(0, { opacity: 0 }, 'linear');
    const k1 = kf(10, { opacity: 1 });
    const result = interpolateAt([k0, k1], 5);
    expect(result).not.toBeNull();
    expect(result!.opacity).toBeCloseTo(0.5, 5);
  });

  it('interpolates at exact keyframe frame', () => {
    const k0 = kf(0, { opacity: 0 });
    const k1 = kf(10, { opacity: 1 });
    const result = interpolateAt([k0, k1], 0);
    expect(result!.opacity).toBe(0);
    const result2 = interpolateAt([k0, k1], 10);
    expect(result2!.opacity).toBe(1);
  });

  it('interpolates all properties (x, y, rotation, etc.)', () => {
    const k0 = kf(0, { x: 0, y: 0, rotation: 0 }, 'linear');
    const k1 = kf(10, { x: 100, y: 200, rotation: 90 });
    const result = interpolateAt([k0, k1], 5);
    expect(result!.x).toBeCloseTo(50, 5);
    expect(result!.y).toBeCloseTo(100, 5);
    expect(result!.rotation).toBeCloseTo(45, 5);
  });

  it('handles three keyframes correctly', () => {
    const k0 = kf(0, { opacity: 0 }, 'linear');
    const k1 = kf(10, { opacity: 1 }, 'linear');
    const k2 = kf(20, { opacity: 0.5 });
    // Between first two
    const r1 = interpolateAt([k0, k1, k2], 5);
    expect(r1!.opacity).toBeCloseTo(0.5, 5);
    // Between second and third
    const r2 = interpolateAt([k0, k1, k2], 15);
    expect(r2!.opacity).toBeCloseTo(0.75, 5);
  });
});

describe('applyEasing', () => {
  it('linear: returns input unchanged', () => {
    expect(applyEasing(0, 'linear')).toBe(0);
    expect(applyEasing(1, 'linear')).toBe(1);
    expect(applyEasing(0.5, 'linear')).toBe(0.5);
  });

  it('ease-in: starts at 0, ends at 1', () => {
    expect(applyEasing(0, 'ease-in')).toBe(0);
    expect(applyEasing(1, 'ease-in')).toBe(1);
  });

  it('ease-in: midpoint is less than 0.5 (slow start)', () => {
    expect(applyEasing(0.5, 'ease-in')).toBeLessThan(0.5);
  });

  it('ease-out: starts at 0, ends at 1', () => {
    expect(applyEasing(0, 'ease-out')).toBe(0);
    expect(applyEasing(1, 'ease-out')).toBe(1);
  });

  it('ease-out: midpoint is greater than 0.5 (fast start)', () => {
    expect(applyEasing(0.5, 'ease-out')).toBeGreaterThan(0.5);
  });

  it('ease-in-out: starts at 0, ends at 1', () => {
    expect(applyEasing(0, 'ease-in-out')).toBe(0);
    expect(applyEasing(1, 'ease-in-out')).toBe(1);
  });

  it('ease-in-out: symmetric midpoint is 0.5', () => {
    expect(applyEasing(0.5, 'ease-in-out')).toBeCloseTo(0.5, 5);
  });
});

describe('lerpValues', () => {
  it('interpolates all 7 properties', () => {
    const a: KeyframeValues = { opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, blur: 0 };
    const b: KeyframeValues = { opacity: 1, x: 100, y: 200, scaleX: 2, scaleY: 3, rotation: 360, blur: 0.5 };
    const result = lerpValues(a, b, 0.5);
    expect(result.opacity).toBeCloseTo(0.5, 5);
    expect(result.x).toBeCloseTo(50, 5);
    expect(result.y).toBeCloseTo(100, 5);
    expect(result.scaleX).toBeCloseTo(1.5, 5);
    expect(result.scaleY).toBeCloseTo(2, 5);
    expect(result.rotation).toBeCloseTo(180, 5);
    expect(result.blur).toBeCloseTo(0.25, 5);
  });

  it('returns a values at t=0', () => {
    const a: KeyframeValues = { opacity: 0.3, x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 45, blur: 0.1 };
    const b: KeyframeValues = { opacity: 1, x: 100, y: 200, scaleX: 2, scaleY: 3, rotation: 360, blur: 0.5 };
    const result = lerpValues(a, b, 0);
    expect(result.opacity).toBe(0.3);
    expect(result.x).toBe(10);
    expect(result.rotation).toBe(45);
  });

  it('returns b values at t=1', () => {
    const a: KeyframeValues = { opacity: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, blur: 0 };
    const b: KeyframeValues = { opacity: 1, x: 100, y: 200, scaleX: 2, scaleY: 3, rotation: 360, blur: 0.5 };
    const result = lerpValues(a, b, 1);
    expect(result.opacity).toBe(1);
    expect(result.x).toBe(100);
    expect(result.rotation).toBe(360);
  });
});

describe('extractKeyframeValues', () => {
  it('extracts values from a Layer correctly', () => {
    const layer = {
      id: 'test',
      name: 'Test',
      type: 'static-image' as const,
      visible: true,
      opacity: 0.7,
      blendMode: 'normal' as const,
      transform: { x: 10, y: 20, scaleX: 1.5, scaleY: 2, rotation: 45, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'static-image' as const, imageId: 'img1' },
      blur: 0.3,
    } satisfies Layer;
    const values = extractKeyframeValues(layer);
    expect(values.opacity).toBe(0.7);
    expect(values.x).toBe(10);
    expect(values.y).toBe(20);
    expect(values.scaleX).toBe(1.5);
    expect(values.scaleY).toBe(2);
    expect(values.rotation).toBe(45);
    expect(values.blur).toBe(0.3);
  });

  it('defaults blur to 0 when undefined', () => {
    const layer = {
      id: 'test',
      name: 'Test',
      type: 'static-image' as const,
      visible: true,
      opacity: 1,
      blendMode: 'normal' as const,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0 },
      source: { type: 'static-image' as const, imageId: 'img1' },
    } satisfies Layer;
    const values = extractKeyframeValues(layer);
    expect(values.blur).toBe(0);
  });
});
