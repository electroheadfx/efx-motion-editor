import { describe, expect, it } from 'vitest';
import {
  RAIL_MOTION_IDENTITY_TRANSFORM,
  evaluateRailMotion,
  evaluateRailMotionChannel,
  resolveRailLocalFrame,
} from './railMotionEvaluator';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';

function key(
  frame: number,
  value: number,
  easing: 'hold' | 'ease' = 'ease',
  wiggle = 0,
): PhysicPaintRotoRailMotionKey {
  return { frame, value, easing, wiggle };
}

function channel(
  id: PhysicPaintRotoRailMotionChannelId,
  keys: readonly PhysicPaintRotoRailMotionKey[],
): PhysicPaintRotoRailMotionChannel {
  return { id, keys };
}

function record(
  railId: string,
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): PhysicPaintRotoRailMotionRecord {
  return { railId, anchorKeyId: `anchor-${railId}`, channels };
}

describe('rail motion channel evaluation', () => {
  it('returns the frozen identity transform for an absent or empty record', () => {
    expect(evaluateRailMotion(null, 7)).toBe(RAIL_MOTION_IDENTITY_TRANSFORM);
    expect(evaluateRailMotion(record('rail-empty', []), 7)).toBe(RAIL_MOTION_IDENTITY_TRANSFORM);
    expect(Object.isFrozen(RAIL_MOTION_IDENTITY_TRANSFORM)).toBe(true);
    expect(RAIL_MOTION_IDENTITY_TRANSFORM).toEqual({
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotationRadians: 0,
      opacity: 1,
    });
  });

  it('contributes the identity value for a channel the record does not carry', () => {
    const rec = record('rail-missing', [
      channel('position-x', [key(0, 10)]),
      channel('position-y', [key(0, 20)]),
    ]);

    expect(evaluateRailMotionChannel(rec, 'scale', 0)).toBe(1);
    expect(evaluateRailMotionChannel(rec, 'rotation', 0)).toBe(0);
    expect(evaluateRailMotionChannel(rec, 'opacity', 0)).toBe(1);
    expect(evaluateRailMotionChannel(rec, 'position-y', 0)).toBe(20);
    expect(evaluateRailMotionChannel(null, 'scale', 0)).toBe(1);
    expect(evaluateRailMotionChannel(null, 'position-x', 0)).toBe(0);
  });

  it('holds the first value before the first key and the last value after the last key', () => {
    const rec = record('rail-hold', [channel('position-x', [key(10, 5), key(20, 15)])]);

    expect(evaluateRailMotionChannel(rec, 'position-x', -3)).toBe(5);
    expect(evaluateRailMotionChannel(rec, 'position-x', 10)).toBe(5);
    expect(evaluateRailMotionChannel(rec, 'position-x', 20)).toBe(15);
    expect(evaluateRailMotionChannel(rec, 'position-x', 300)).toBe(15);
  });

  it('steps across a hold segment and jumps at the next key', () => {
    const rec = record('rail-step', [channel('position-x', [key(0, 0, 'hold'), key(10, 100)])]);

    expect(evaluateRailMotionChannel(rec, 'position-x', 5)).toBe(0);
    expect(evaluateRailMotionChannel(rec, 'position-x', 9.999)).toBe(0);
    expect(evaluateRailMotionChannel(rec, 'position-x', 10)).toBe(100);
    expect(evaluateRailMotionChannel(rec, 'position-x', 11)).toBe(100);
  });

  it('eases between two keys with a monotone smoothstep that hits both endpoints', () => {
    const rec = record('rail-ease', [channel('rotation', [key(0, 0), key(10, 100)])]);

    expect(evaluateRailMotionChannel(rec, 'rotation', 0)).toBe(0);
    expect(evaluateRailMotionChannel(rec, 'rotation', 5)).toBe(50);
    expect(evaluateRailMotionChannel(rec, 'rotation', 10)).toBe(100);
    // t = 0.25 -> t*t*(3-2t) = 0.15625; a linear ramp would read 25.
    expect(evaluateRailMotionChannel(rec, 'rotation', 2.5)).toBe(15.625);

    let previous = Number.NEGATIVE_INFINITY;
    for (let step = 0; step <= 100; step += 1) {
      const value = evaluateRailMotionChannel(rec, 'rotation', step / 10);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      previous = value;
    }
  });

  it('holds a single-key channel at that value everywhere', () => {
    const rec = record('rail-single', [channel('scale', [key(7, 2)])]);

    expect(evaluateRailMotionChannel(rec, 'scale', -1)).toBe(2);
    expect(evaluateRailMotionChannel(rec, 'scale', 7)).toBe(2);
    expect(evaluateRailMotionChannel(rec, 'scale', 1000)).toBe(2);
  });

  it('interpolates rotation in degrees with no wrap and converts once at the boundary', () => {
    const fullTurn = record('rail-360', [channel('rotation', [key(0, 0), key(10, 360)])]);
    expect(evaluateRailMotionChannel(fullTurn, 'rotation', 5)).toBe(180);
    expect(evaluateRailMotion(fullTurn, 5).rotationRadians).toBeCloseTo(Math.PI, 12);

    const twoTurns = record('rail-720', [channel('rotation', [key(0, 0), key(10, 720)])]);
    // No modulo: the midpoint is 360 degrees, not 0.
    expect(evaluateRailMotionChannel(twoTurns, 'rotation', 5)).toBe(360);
    expect(evaluateRailMotion(twoTurns, 5).rotationRadians).toBeCloseTo(Math.PI * 2, 12);

    const negative = record('rail-negative', [channel('rotation', [key(0, -90), key(10, 90)])]);
    expect(evaluateRailMotionChannel(negative, 'rotation', 5)).toBe(0);

    const stored720 = record('rail-stored-720', [channel('rotation', [key(0, 720)])]);
    expect(evaluateRailMotionChannel(stored720, 'rotation', 0)).toBe(720);
  });

  it('evaluates the grouped Position channels independently', () => {
    const rec = record('rail-position', [
      channel('position-x', [key(0, 0), key(10, 100)]),
      channel('position-y', [key(0, 0), key(10, -50)]),
    ]);

    const transform = evaluateRailMotion(rec, 5);
    expect(transform.translateX).toBe(50);
    expect(transform.translateY).toBe(-25);
  });

  it('assembles a frozen transform with identity defaults for absent channels', () => {
    const rec = record('rail-rotation', [channel('rotation', [key(0, 90)])]);

    const transform = evaluateRailMotion(rec, 0);
    expect(transform).toEqual({
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotationRadians: Math.PI / 2,
      opacity: 1,
    });
    expect(Object.isFrozen(transform)).toBe(true);
  });

  it('accepts fractional and negative rail-local frames', () => {
    const rec = record('rail-fractional', [channel('position-x', [key(0, 0), key(10, 100)])]);

    expect(evaluateRailMotionChannel(rec, 'position-x', 2.5)).toBe(15.625);
    expect(evaluateRailMotionChannel(rec, 'position-x', -4)).toBe(0);
    expect(evaluateRailMotion(rec, 2.5).translateX).toBe(15.625);
  });

  it('clamps opacity to 0..1 and floors scale at 0 after evaluation', () => {
    const rec = record('rail-clamp', [
      channel('opacity', [key(0, 1.4)]),
      channel('scale', [key(0, -2)]),
    ]);

    expect(evaluateRailMotionChannel(rec, 'opacity', 0)).toBe(1);
    expect(evaluateRailMotionChannel(rec, 'scale', 0)).toBe(0);
  });
});

describe('rail motion rail-local frame resolution', () => {
  it('subtracts the rail start and clamps before the rail at zero', () => {
    expect(resolveRailLocalFrame(100, 40)).toBe(60);
    expect(resolveRailLocalFrame(40, 100)).toBe(0);
    expect(resolveRailLocalFrame(100.5, 40)).toBe(60.5);
  });

  it('throws on a non-finite app frame or rail start', () => {
    expect(() => resolveRailLocalFrame(Number.NaN, 0)).toThrow(/finite/);
    expect(() => resolveRailLocalFrame(0, Number.POSITIVE_INFINITY)).toThrow(/finite/);
    expect(() => resolveRailLocalFrame(Number.NEGATIVE_INFINITY, 0)).toThrow(/finite/);
  });
});
