import { describe, expect, it } from 'vitest';
import type { StudioPoint, StudioStroke } from './types';
import { buildStaticStrokeSchedule, getStaticFrameStrokes } from './staticStrokeSchedule';

interface TestPayload {
  tool: string;
  params: Record<string, number>;
  physicsMode: string | null;
}

const point = (index: number): StudioPoint => ({ x: index, y: index * 2, p: 0.5, tx: 0, ty: 0, tw: 0, tick: index });
const stroke = (color: string, points: number, recordedOrder: number, playFrame?: number): StudioStroke<TestPayload> => ({
  pts: Array.from({ length: points }, (_, index) => point(index)),
  ticks: Math.max(1, points - 1),
  cuisson: 0,
  motion: null,
  brushId: 'test-brush',
  toolOverrides: {},
  traceSeed: recordedOrder,
  recordedOrder,
  playFrame: playFrame ?? null,
  color,
  engine: {
    tool: 'paint',
    params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
    physicsMode: color === '#physics' ? 'local' : null,
  },
});
const eraseStroke = (points: number, recordedOrder: number): StudioStroke<TestPayload> => ({
  pts: Array.from({ length: points }, (_, index) => point(index)),
  ticks: Math.max(1, points - 1),
  cuisson: 0,
  motion: null,
  brushId: 'test-brush',
  toolOverrides: {},
  traceSeed: recordedOrder,
  recordedOrder,
  playFrame: null,
  color: null,
  engine: {
    tool: 'erase',
    params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
    physicsMode: null,
  },
});
const hold = (strokes: readonly StudioStroke<TestPayload>[], frames: number, frame: number) => getStaticFrameStrokes(buildStaticStrokeSchedule(strokes, frames), frame);

describe('static/hold stroke scheduler', () => {
  it('returns the complete stroke set with full pointCount on the first frame', () => {
    const strokes = [stroke('#a', 4, 0), stroke('#b', 7, 1), stroke('#c', 3, 2)];
    const frame = hold(strokes, 5, 0);
    expect(frame.map((entry) => entry.stroke.color)).toEqual(['#a', '#b', '#c']);
    expect(frame.map((entry) => entry.pointCount)).toEqual([4, 7, 3]);
    expect(frame.every((entry) => entry.pointCount === entry.stroke.pts.length)).toBe(true);
  });

  it('returns the identical complete set on the last frame (inclusive boundaries)', () => {
    const strokes = [stroke('#a', 4, 0), stroke('#b', 7, 1), stroke('#c', 3, 2)];
    const first = hold(strokes, 5, 0);
    const last = hold(strokes, 5, 4);
    expect(last.map((entry) => entry.stroke)).toEqual(first.map((entry) => entry.stroke));
    expect(last.map((entry) => entry.pointCount)).toEqual(first.map((entry) => entry.pointCount));
  });

  it('returns the complete set when frameCount is 1 (minimum hold)', () => {
    const strokes = [stroke('#a', 5, 0), stroke('#b', 2, 1)];
    const frame = hold(strokes, 1, 0);
    expect(frame).toHaveLength(2);
    expect(frame.map((entry) => entry.pointCount)).toEqual([5, 2]);
  });

  it('returns empty for no strokes', () => {
    expect(hold([], 5, 0)).toEqual([]);
  });

  it('holds erase strokes alongside paint strokes', () => {
    const strokes = [stroke('#p', 4, 0), eraseStroke(3, 1)];
    const frame = hold(strokes, 3, 1);
    expect(frame).toHaveLength(2);
    expect(frame[0].stroke.color).toBe('#p');
    expect(frame[1].stroke.color).toBeNull();
    expect(frame[1].stroke.engine.tool).toBe('erase');
    expect(frame.map((entry) => entry.pointCount)).toEqual([4, 3]);
  });

  it('preserves per-stroke engine payload through the schedule', () => {
    const strokes = [stroke('#physics', 4, 0)];
    const frame = hold(strokes, 2, 0);
    expect(frame[0].stroke.engine.physicsMode).toBe('local');
    expect(frame[0].stroke.engine.params).toMatchObject({ size: 8, opacity: 70, pressure: 65, pickup: 3 });
  });
});
