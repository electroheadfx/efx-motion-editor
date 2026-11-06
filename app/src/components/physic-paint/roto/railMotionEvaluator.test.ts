import { describe, expect, it } from 'vitest';
import {
  RAIL_MOTION_IDENTITY_TRANSFORM,
  buildRailMotionCurvePath,
  evaluateRailMotion,
  evaluateRailMotionChannel,
  railMotionWiggleAt,
  resolveRailLocalFrame,
} from './railMotionEvaluator';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import { TIMELINE_GEOMETRY } from '../view/timelineRailDesign';

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

describe('rail motion wiggle', () => {
  it('seeds differently per rail, channel and key frame', () => {
    const base = railMotionWiggleAt('rail-a', 'position-x', 0, 17.5);

    expect(railMotionWiggleAt('rail-b', 'position-x', 0, 17.5)).not.toBe(base);
    expect(railMotionWiggleAt('rail-a', 'scale', 0, 17.5)).not.toBe(base);
    expect(railMotionWiggleAt('rail-a', 'position-x', 10, 17.5)).not.toBe(base);
  });

  it('is deterministic across repeated and interleaved calls', () => {
    const first = railMotionWiggleAt('rail-a', 'position-x', 3, 12.5);
    // An unrelated evaluation between the two calls must not move any state.
    railMotionWiggleAt('rail-z', 'opacity', 9, 4.25);

    expect(railMotionWiggleAt('rail-a', 'position-x', 3, 12.5)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(-1);
    expect(first).toBeLessThanOrEqual(1);
  });

  it('interpolates smoothly between integer-frame noise samples', () => {
    const at10 = railMotionWiggleAt('rail-a', 'position-x', 0, 10);
    const at11 = railMotionWiggleAt('rail-a', 'position-x', 0, 11);
    const halfway = railMotionWiggleAt('rail-a', 'position-x', 0, 10.5);

    expect(at10).not.toBe(at11);
    expect(halfway).toBeCloseTo((at10 + at11) / 2, 12);
  });

  it('applies the outgoing key amplitude and drops a zero-amplitude outgoing key', () => {
    const railId = 'rail-wiggle';
    const wiggled = record(railId, [
      channel('position-x', [key(0, 0, 'ease', 10), key(10, 100, 'ease', 0)]),
    ]);
    const plain = record(railId, [channel('position-x', [key(0, 0), key(10, 100)])]);

    const expectedAtTwo = evaluateRailMotionChannel(plain, 'position-x', 2)
      + 10 * railMotionWiggleAt(railId, 'position-x', 0, 2);
    expect(evaluateRailMotionChannel(wiggled, 'position-x', 2)).toBeCloseTo(expectedAtTwo, 12);

    // After the last key the outgoing key is the wiggle-free key at frame 10.
    expect(evaluateRailMotionChannel(wiggled, 'position-x', 12)).toBe(100);
  });

  it('wiggles around a hold key step value', () => {
    const railId = 'rail-hold-wiggle';
    const rec = record(railId, [
      channel('position-y', [key(0, 20, 'hold', 5), key(10, 80)]),
    ]);

    const expectedAtFour = 20 + 5 * railMotionWiggleAt(railId, 'position-y', 0, 4);
    expect(evaluateRailMotionChannel(rec, 'position-y', 4)).toBeCloseTo(expectedAtFour, 12);
    expect(evaluateRailMotionChannel(rec, 'position-y', 10)).toBe(80);
  });

  it('returns exactly the eased value when the amplitude is zero', () => {
    const plain = record('rail-plain', [channel('rotation', [key(0, 0), key(10, 90, 'ease', 0)])]);
    const withZeroWiggle = record('rail-plain', [
      channel('rotation', [key(0, 0, 'ease', 0), key(10, 90, 'ease', 0)]),
    ]);

    for (let frame = 0; frame <= 12; frame += 0.5) {
      expect(evaluateRailMotionChannel(withZeroWiggle, 'rotation', frame))
        .toBe(evaluateRailMotionChannel(plain, 'rotation', frame));
    }
  });

  it('clamps opacity to 0..1 and floors scale at 0 after adding wiggle', () => {
    const railId = 'rail-clamp-wiggle';
    const rec = record(railId, [
      channel('opacity', [key(0, 1, 'ease', 1000)]),
      channel('scale', [key(0, 0.05, 'ease', 1000)]),
    ]);

    let clampedHigh = false;
    let clampedLow = false;
    for (let frame = 0; frame <= 60; frame += 0.25) {
      const opacityWiggle = railMotionWiggleAt(railId, 'opacity', 0, frame);
      const scaleWiggle = railMotionWiggleAt(railId, 'scale', 0, frame);
      const opacity = evaluateRailMotionChannel(rec, 'opacity', frame);
      const scale = evaluateRailMotionChannel(rec, 'scale', frame);

      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
      expect(scale).toBeGreaterThanOrEqual(0);
      if (opacityWiggle > 0.01) clampedHigh = true;
      if (scaleWiggle < -0.01) clampedLow = true;
    }

    expect(clampedHigh).toBe(true);
    expect(clampedLow).toBe(true);
  });
});

interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

function parseCurvePath(path: string): CurvePoint[] {
  const points: CurvePoint[] = [];
  const pattern = /([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    points.push({ x: Number(match[2]), y: Number(match[3]) });
  }
  return points;
}

/** The SPECS display ranges, written independently of the implementation. */
const CURVE_RANGES: Readonly<Record<PhysicPaintRotoRailMotionChannelId, readonly [number, number]>> = {
  'position-x': [-100, 100],
  'position-y': [-100, 100],
  scale: [0, 2],
  rotation: [-360, 360],
  opacity: [0, 1],
};

function expectedCurveY(
  channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
  laneHeight = TIMELINE_GEOMETRY.motionLaneHeight,
): number {
  const [min, max] = CURVE_RANGES[channelId];
  const normalized = (value - min) / (max - min);
  return Math.min(laneHeight, Math.max(0, laneHeight - normalized * laneHeight));
}

describe('rail motion lane curve', () => {
  it('starts with M and writes at most one decimal place', () => {
    const path = buildRailMotionCurvePath(channel('position-x', [key(0, 0), key(10, 100)]), 12);

    expect(path.startsWith('M')).toBe(true);
    expect(path).toMatch(/^M-?\d+(?:\.\d)?,-?\d+(?:\.\d)?(?: L-?\d+(?:\.\d)?,-?\d+(?:\.\d)?)+$/);
  });

  it('draws a horizontal line for a single-key channel', () => {
    const path = buildRailMotionCurvePath(channel('opacity', [key(4, 0.5)]), 12);
    const points = parseCurvePath(path);

    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[0]).toEqual({ x: 0, y: 9 });
    expect(points[points.length - 1]).toEqual({ x: 11 * TIMELINE_GEOMETRY.cellPitch, y: 9 });
    for (const point of points) expect(point.y).toBe(9);
  });

  it('emits an explicit vertical step at a hold key frame', () => {
    const path = buildRailMotionCurvePath(
      channel('position-x', [key(0, -100, 'hold'), key(6, 100)]),
      10,
    );
    const points = parseCurvePath(path);
    const stepX = 6 * TIMELINE_GEOMETRY.cellPitch;

    let stepIndex = -1;
    for (let index = 1; index < points.length; index += 1) {
      if (
        points[index].x === stepX
        && points[index - 1].x === stepX
        && points[index].y !== points[index - 1].y
      ) {
        stepIndex = index;
        break;
      }
    }

    expect(stepIndex).toBeGreaterThan(0);
    expect(points[stepIndex - 1].y).toBe(18);
    expect(points[stepIndex].y).toBe(0);
    for (const point of points.slice(0, stepIndex - 1)) expect(point.y).toBe(18);
  });

  it('samples an ease channel from the evaluator at each frame', () => {
    const path = buildRailMotionCurvePath(
      channel('position-x', [key(0, 0), key(10, 100)]),
      11,
    );
    const points = parseCurvePath(path);
    const atFrame = (frame: number): CurvePoint | undefined => (
      points.find((point) => point.x === frame * TIMELINE_GEOMETRY.cellPitch)
    );

    expect(atFrame(0)?.y).toBe(9);
    expect(atFrame(5)?.y).toBeCloseTo(4.5, 9);
    expect(atFrame(10)?.y).toBe(0);
  });

  it('clamps every y inside the lane for values beyond the display range', () => {
    const path = buildRailMotionCurvePath(
      channel('rotation', [key(0, 720, 'hold'), key(5, -720)]),
      8,
    );
    const points = parseCurvePath(path);

    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(TIMELINE_GEOMETRY.motionLaneHeight);
    }
    expect(points[0].y).toBe(0);
    expect(points[points.length - 1].y).toBe(TIMELINE_GEOMETRY.motionLaneHeight);
  });

  it('caps sampling for a rail longer than the sample budget but keeps the full width', () => {
    const path = buildRailMotionCurvePath(
      channel('position-x', [key(0, 0), key(4096, 100)]),
      4097,
    );
    const points = parseCurvePath(path);

    expect(points.length).toBeLessThanOrEqual(4096);
    expect(points[points.length - 1].x).toBe(4096 * TIMELINE_GEOMETRY.cellPitch);
  });

  it('matches evaluateRailMotionChannel at every sampled frame', () => {
    const railId = 'rail-curve';
    const positionChannel = channel(
      'position-x',
      [key(0, -30, 'ease', 12), key(9, 70)],
    );
    const rec = record(railId, [positionChannel]);
    const path = buildRailMotionCurvePath(positionChannel, 10, TIMELINE_GEOMETRY.motionLaneHeight, {
      railId,
    });
    const points = parseCurvePath(path);

    for (const frame of [0, 2, 4, 6, 8, 9]) {
      const point = points.find(
        (candidate) => candidate.x === frame * TIMELINE_GEOMETRY.cellPitch,
      );
      expect(point).toBeDefined();
      const value = evaluateRailMotionChannel(rec, 'position-x', frame);
      const expected = expectedCurveY('position-x', value);
      expect(point?.y).toBeCloseTo(expected, 1);
    }
  });

  it('honours an explicit cell pitch and lane height', () => {
    const path = buildRailMotionCurvePath(channel('opacity', [key(0, 1)]), 5, 20, { cellPitch: 12 });
    const points = parseCurvePath(path);

    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1].x).toBe(4 * 12);
  });

  it('uses the design-token pitch by default', () => {
    const path = buildRailMotionCurvePath(channel('opacity', [key(0, 1)]), 4);
    const points = parseCurvePath(path);

    expect(points[points.length - 1].x).toBe(3 * TIMELINE_GEOMETRY.cellPitch);
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
