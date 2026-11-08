import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  PhysicPaintRotoRailMotionEasing,
  PhysicPaintRotoRailMotionKey,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import { TIMELINE_GEOMETRY } from '../view/timelineRailDesign';

function key(
  frame: number,
  value: number,
  easing: PhysicPaintRotoRailMotionEasing = 'ease',
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

  it('ramps linear keys raw, with no smoothstep', () => {
    // 261108-d5o: keys 0 -> 0 and 8 -> 80. A raw t reads 10 / 20 / 60 at
    // frames 1 / 2 / 6; the same ramp through smoothstep would read
    // 80 * 0.043478... = 3.4375, 80 * 0.15625 = 12.5 and 80 * 0.84375 = 67.5.
    const linear = record('rail-linear', [
      channel('position-x', [key(0, 0, 'linear'), key(8, 80, 'linear')]),
    ]);

    expect(evaluateRailMotionChannel(linear, 'position-x', 1)).toBe(10);
    expect(evaluateRailMotionChannel(linear, 'position-x', 2)).toBe(20);
    expect(evaluateRailMotionChannel(linear, 'position-x', 6)).toBe(60);
    expect(evaluateRailMotionChannel(linear, 'position-x', 0)).toBe(0);
    expect(evaluateRailMotionChannel(linear, 'position-x', 8)).toBe(80);
  });

  it('treats a stop-motion key with no snap list exactly like hold', () => {
    const stopMotion = record('rail-stop-motion', [
      channel('position-x', [key(0, 0, 'stop-motion'), key(6, 6, 'stop-motion')]),
    ]);
    const hold = record('rail-stop-motion', [
      channel('position-x', [key(0, 0, 'hold'), key(6, 6, 'hold')]),
    ]);

    for (const frame of [0, 1, 2, 3.5, 4, 5, 5.999, 6, 7]) {
      expect(evaluateRailMotionChannel(stopMotion, 'position-x', frame)).toBe(
        evaluateRailMotionChannel(hold, 'position-x', frame),
      );
    }
    expect(evaluateRailMotionChannel(stopMotion, 'position-x', 3)).toBe(0);
    expect(evaluateRailMotionChannel(stopMotion, 'position-x', 6)).toBe(6);
  });

  it('samples a stop-motion span at the greatest snap frame at or before the frame', () => {
    // 261108-d5o oracle: keys 0 -> 0 and 6 -> 6 across [0,6] with the
    // rail-local paint snaps [0,2,4,6]. The law snaps to the greatest s <=
    // frame (and >= the outgoing key frame), then ramps 0 -> 6 over [0,6]:
    // value = 6 * (sampleFrame / 6) = sampleFrame. Fractions read their own
    // sample: 1.5 -> 0 and 2.5 -> 2.
    const rec = record('rail-snapped', [
      channel('position-x', [key(0, 0, 'stop-motion'), key(6, 6, 'stop-motion')]),
    ]);
    const snapFrames = [0, 2, 4, 6] as const;

    expect(
      [0, 1, 2, 3, 4, 5, 6].map((frame) => (
        evaluateRailMotionChannel(rec, 'position-x', frame, snapFrames)
      )),
    ).toEqual([0, 0, 2, 2, 4, 4, 6]);
    expect(evaluateRailMotionChannel(rec, 'position-x', 1.5, snapFrames)).toBe(0);
    expect(evaluateRailMotionChannel(rec, 'position-x', 2.5, snapFrames)).toBe(2);
    expect(evaluateRailMotionChannel(rec, 'position-x', 6, snapFrames)).toBe(6);
  });

  it('keeps motion keys independent of paint keys and ignores snaps outside the outgoing span', () => {
    // Keys 0 -> 0 and 5 -> 50, both stop-motion, over snaps [0,2,4,6]. The ramp
    // is 0 + 50 * (sampleFrame / 5) = 10 * sampleFrame, so frames 0..6 read
    // 0,0,20,20,40,50,50: the steps sit at 2 and 4 ONLY, and frame 5 is the
    // key's own value. Paint key 6 belongs to the NEXT span, so deleting it
    // leaves every value up to frame 5 identical.
    const rec = record('rail-snap-independence', [
      channel('position-x', [key(0, 0, 'stop-motion'), key(5, 50, 'stop-motion')]),
    ]);

    expect(
      [0, 1, 2, 3, 4, 5, 6].map((frame) => (
        evaluateRailMotionChannel(rec, 'position-x', frame, [0, 2, 4, 6])
      )),
    ).toEqual([0, 0, 20, 20, 40, 50, 50]);
    for (let frame = 0; frame <= 5; frame += 0.25) {
      expect(evaluateRailMotionChannel(rec, 'position-x', frame, [0, 2, 4]))
        .toBe(evaluateRailMotionChannel(rec, 'position-x', frame, [0, 2, 4, 6]));
    }
    // A snap beyond the outgoing span is never eligible.
    expect(evaluateRailMotionChannel(rec, 'position-x', 4, [0, 4, 9])).toBe(40);
  });

  it('falls back to the outgoing value with no interior snap and is byte-identical to hold', () => {
    const stopMotion = record('rail-snap-fail-closed', [
      channel('position-x', [key(0, 0, 'stop-motion'), key(6, 6, 'stop-motion')]),
    ]);
    const hold = record('rail-snap-fail-closed', [
      channel('position-x', [key(0, 0, 'hold'), key(6, 6, 'hold')]),
    ]);

    for (let frame = 0; frame < 6; frame += 0.25) {
      expect(evaluateRailMotionChannel(stopMotion, 'position-x', frame, [0, 6])).toBe(0);
    }
    expect(evaluateRailMotionChannel(stopMotion, 'position-x', 6, [0, 6])).toBe(6);
    for (const frame of [0, 1, 2, 3.5, 4, 5, 5.999, 6, 7]) {
      expect(evaluateRailMotionChannel(stopMotion, 'position-x', frame, [0, 6]))
        .toBe(evaluateRailMotionChannel(hold, 'position-x', frame));
    }
  });

  it('leaves hold, ease and linear keys byte-identical with and without a snap list', () => {
    const snapFrames = [0, 2, 4, 6] as const;
    for (const easing of ['hold', 'ease', 'linear'] as const) {
      const rec = record(`rail-snap-inert-${easing}`, [
        channel('position-x', [key(0, 0, easing), key(6, 6, easing)]),
      ]);
      for (let frame = -1; frame <= 8; frame += 0.5) {
        expect(evaluateRailMotionChannel(rec, 'position-x', frame, snapFrames))
          .toBe(evaluateRailMotionChannel(rec, 'position-x', frame));
      }
    }
  });

  it('dispatches easing through an explicit exhaustive switch, never a hold-else-smoothstep branch', () => {
    // T-261108-D5O-03: a new token must not be able to fall through into the
    // smoothstep default. The switch is asserted at the source so a future
    // value cannot be added to the union and silently eased.
    const sourcePath = fileURLToPath(new URL('./railMotionEvaluator.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');
    const start = source.indexOf('function resolveRailMotionSegment');
    expect(start).toBeGreaterThanOrEqual(0);
    const functionSource = source.slice(start, source.indexOf('\n}\n', start));

    expect(functionSource).toContain('switch (');
    for (const token of ['linear', 'hold', 'ease', 'stop-motion']) {
      expect(functionSource).toContain(`case '${token}':`);
    }
    expect(functionSource).toMatch(/default:\s*\n?\s*\{\s*\n?\s*const exhaustive: never =/);
    expect(functionSource).not.toMatch(/===\s*'hold'/);
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

  it('samples stop-motion wiggle at the snapped frame, not the evaluated frame', () => {
    const railId = 'rail-snap-wiggle';
    const snapFrames = [0, 2, 4, 6] as const;
    const stopMotion = record(railId, [
      channel('position-x', [key(0, 0, 'stop-motion', 5), key(6, 60, 'stop-motion', 0)]),
    ]);
    const eased = record(railId, [
      channel('position-x', [key(0, 0, 'ease', 5), key(6, 60, 'ease', 0)]),
    ]);

    const snapped = [2, 2.25, 2.5, 2.75].map((frame) => (
      evaluateRailMotionChannel(stopMotion, 'position-x', frame, snapFrames)
    ));
    for (const value of snapped) expect(value).toBe(snapped[0]);
    // The ramp is 60 * 2/6 = 20 plus the outgoing amplitude at the sample.
    expect(snapped[0]).toBeCloseTo(
      20 + 5 * railMotionWiggleAt(railId, 'position-x', 0, 2),
      12,
    );

    const easedValues = [2, 2.25, 2.5, 2.75].map((frame) => (
      evaluateRailMotionChannel(eased, 'position-x', frame)
    ));
    expect(new Set(easedValues).size).toBeGreaterThan(1);
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

  it('draws a true staircase at every interior stop-motion snap and key frame', () => {
    const positionChannel = channel('position-x', [
      key(0, 0, 'stop-motion'),
      key(6, 6, 'stop-motion'),
    ]);
    const snapFrames = [0, 2, 4, 6] as const;
    const path = buildRailMotionCurvePath(positionChannel, 7, TIMELINE_GEOMETRY.motionLaneHeight, {
      railId: 'rail-staircase',
      snapFrames,
    });
    const points = parseCurvePath(path);
    const verticalStepAt = (frame: number): boolean => {
      const x = frame * TIMELINE_GEOMETRY.cellPitch;
      for (let index = 1; index < points.length; index += 1) {
        if (
          points[index].x === x
          && points[index - 1].x === x
          && points[index].y !== points[index - 1].y
        ) {
          return true;
        }
      }
      return false;
    };

    // Two points at the same x with different y at interior snaps 2 and 4 and
    // at the closing stop-motion key frame 6.
    expect(verticalStepAt(2)).toBe(true);
    expect(verticalStepAt(4)).toBe(true);
    expect(verticalStepAt(6)).toBe(true);

    // Without the snap list the same channel draws the hold fallback: one flat
    // line to the key frame, and no steps at 2 or 4.
    const fallback = parseCurvePath(buildRailMotionCurvePath(positionChannel, 7));
    const fallbackStepAt = (frame: number): boolean => {
      const x = frame * TIMELINE_GEOMETRY.cellPitch;
      for (let index = 1; index < fallback.length; index += 1) {
        if (
          fallback[index].x === x
          && fallback[index - 1].x === x
          && fallback[index].y !== fallback[index - 1].y
        ) {
          return true;
        }
      }
      return false;
    };
    expect(fallbackStepAt(2)).toBe(false);
    expect(fallbackStepAt(4)).toBe(false);
    expect(fallbackStepAt(6)).toBe(true);
    const fallbackY = expectedCurveY('position-x', 0);
    for (const point of fallback) {
      if (point.x < 6 * TIMELINE_GEOMETRY.cellPitch) expect(point.y).toBe(fallbackY);
    }
  });

  it('ignores the snap list for hold and ease channels', () => {
    const snapFrames = [0, 2, 4, 6] as const;
    for (const easing of ['hold', 'ease'] as const) {
      const positionChannel = channel('position-x', [key(0, 0, easing), key(6, 6, easing)]);
      expect(buildRailMotionCurvePath(positionChannel, 7, TIMELINE_GEOMETRY.motionLaneHeight, {
        railId: 'rail-snap-inert',
        snapFrames,
      })).toBe(buildRailMotionCurvePath(positionChannel, 7, TIMELINE_GEOMETRY.motionLaneHeight, {
        railId: 'rail-snap-inert',
      }));
    }
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

  it('261107-rrp: keeps every shared frame point identical when the rail shrinks', () => {
    // The curve samples the evaluator, so a shorter rail band must not change
    // any frame that is still visible: only the tail beyond the band drops.
    const positionChannel = channel('position-x', [key(0, 0), key(20, 100)]);
    const longPath = parseCurvePath(buildRailMotionCurvePath(positionChannel, 20));
    const shortPath = parseCurvePath(buildRailMotionCurvePath(positionChannel, 10));

    expect(shortPath.length).toBeGreaterThan(0);
    expect(shortPath.length).toBeLessThan(longPath.length);
    for (let index = 0; index < shortPath.length; index += 1) {
      expect(shortPath[index]).toEqual(longPath[index]);
    }
    expect(shortPath[shortPath.length - 1].x).toBe(9 * TIMELINE_GEOMETRY.cellPitch);
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
