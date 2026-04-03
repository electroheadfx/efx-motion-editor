import {describe, it, expect} from 'vitest';
import {hitTestKeyframeCircles} from './motionPathHitTest';
import type {KeyframeCircle} from './motionPathHitTest';

describe('hitTestKeyframeCircles', () => {
  it('returns null for empty circles array', () => {
    expect(hitTestKeyframeCircles({x: 0, y: 0}, [], 1)).toBeNull();
  });

  it('returns index when point is exactly on a circle center (zoom=1)', () => {
    const circles: KeyframeCircle[] = [
      {x: 100, y: 200, frame: 0},
      {x: 300, y: 400, frame: 10},
    ];
    expect(hitTestKeyframeCircles({x: 100, y: 200}, circles, 1)).toBe(0);
    expect(hitTestKeyframeCircles({x: 300, y: 400}, circles, 1)).toBe(1);
  });

  it('returns index when point is within hitScreenSize radius', () => {
    const circles: KeyframeCircle[] = [{x: 100, y: 100, frame: 0}];
    // At zoom=1, hitScreenSize=12, so hitRadius=12. Point at (108, 100) is 8px away.
    expect(hitTestKeyframeCircles({x: 108, y: 100}, circles, 1, 12)).toBe(0);
  });

  it('returns null when point is outside all circles', () => {
    const circles: KeyframeCircle[] = [{x: 100, y: 100, frame: 0}];
    // At zoom=1, hitScreenSize=12, so hitRadius=12. Point at (120, 100) is 20px away.
    expect(hitTestKeyframeCircles({x: 120, y: 100}, circles, 1, 12)).toBeNull();
  });

  it('returns last circle index (reverse iteration) when circles overlap', () => {
    const circles: KeyframeCircle[] = [
      {x: 100, y: 100, frame: 0},
      {x: 100, y: 100, frame: 5}, // Same position -- overlaps first
    ];
    // Both circles overlap at (100,100). Reverse iteration returns last (index 1).
    expect(hitTestKeyframeCircles({x: 100, y: 100}, circles, 1)).toBe(1);
  });

  it('counter-scales hit radius by zoom -- zoom=2, miss at 8px project distance', () => {
    const circles: KeyframeCircle[] = [{x: 100, y: 100, frame: 0}];
    // At zoom=2, hitScreenSize=12, hitRadius=12/2=6. Point 8px away should miss.
    expect(hitTestKeyframeCircles({x: 108, y: 100}, circles, 2, 12)).toBeNull();
  });

  it('counter-scales hit radius by zoom -- zoom=0.5, hit at 20px project distance', () => {
    const circles: KeyframeCircle[] = [{x: 100, y: 100, frame: 0}];
    // At zoom=0.5, hitScreenSize=12, hitRadius=12/0.5=24. Point 20px away should hit.
    expect(hitTestKeyframeCircles({x: 120, y: 100}, circles, 0.5, 12)).toBe(0);
  });
});
