import { describe, expect, it, vi } from 'vitest';
import type { PaintStroke, PenPoint } from '../types';
import { buildStaticStrokeSchedule, getStaticFrameStrokes } from './staticStrokeSchedule';

const point = (index: number): PenPoint => ({ x: index, y: index * 2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 1 });
const stroke = (color: string, points: number, timestamp: number, playFrame?: number): PaintStroke => ({
  tool: 'paint', color, timestamp, ...(playFrame === undefined ? {} : { playFrame }),
  points: Array.from({ length: points }, (_, index) => point(index)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
  physicsMode: color === '#physics' ? 'local' : null,
});
const eraseStroke = (points: number, timestamp: number): PaintStroke => ({
  tool: 'erase', color: null, timestamp,
  points: Array.from({ length: points }, (_, index) => point(index)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
  physicsMode: null,
});
const hold = (strokes: readonly PaintStroke[], frames: number, frame: number) => getStaticFrameStrokes(buildStaticStrokeSchedule(strokes, frames), frame);

describe('static/hold stroke scheduler', () => {
  it('returns the complete stroke set with full pointCount on the first frame', () => {
    const strokes = [stroke('#a', 4, 0), stroke('#b', 7, 1), stroke('#c', 3, 2)];
    const frame = hold(strokes, 5, 0);
    expect(frame.map((entry) => entry.stroke.color)).toEqual(['#a', '#b', '#c']);
    expect(frame.map((entry) => entry.pointCount)).toEqual([4, 7, 3]);
    expect(frame.every((entry) => entry.pointCount === entry.stroke.points.length)).toBe(true);
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

  it('preserves the input flatten order on every frame', () => {
    const strokes = [stroke('#A', 3, 2), stroke('#B', 3, 0), stroke('#C', 3, 1)];
    for (let frameIndex = 0; frameIndex < 6; frameIndex += 1) {
      expect(hold(strokes, 6, frameIndex).map((entry) => entry.stroke.color)).toEqual(['#A', '#B', '#C']);
    }
  });

  it('returns an empty schedule and empty frames for an empty stroke list', () => {
    const schedule = buildStaticStrokeSchedule([], 8);
    expect(schedule).toEqual([]);
    expect(getStaticFrameStrokes(schedule, 0)).toEqual([]);
    expect(getStaticFrameStrokes(schedule, 7)).toEqual([]);
  });

  it('truncates a fractional frameCount (2.7 -> 2 frames)', () => {
    const schedule = buildStaticStrokeSchedule([stroke('#a', 4, 0)], 2.7);
    expect(schedule).toEqual([{ stroke: schedule[0].stroke, startFrame: 0, endFrame: 1, pointsPerFrame: 4 }]);
  });

  it('normalizes a zero frameCount to 1', () => {
    const schedule = buildStaticStrokeSchedule([stroke('#a', 4, 0)], 0);
    expect(schedule).toEqual([{ stroke: schedule[0].stroke, startFrame: 0, endFrame: 0, pointsPerFrame: 4 }]);
    expect(hold([stroke('#a', 4, 0)], 0, 0).map((entry) => entry.pointCount)).toEqual([4]);
  });

  it('invokes the transform once per stroke per accessor call with (stroke, frameIndex, strokeIndex)', () => {
    const strokes = [stroke('#a', 4, 0), stroke('#b', 4, 1), stroke('#c', 4, 2)];
    const schedule = buildStaticStrokeSchedule(strokes, 5);
    const transform = vi.fn((entry: PaintStroke) => ({ ...entry, color: '#override' }));
    const frame = getStaticFrameStrokes(schedule, 3, transform);
    expect(transform).toHaveBeenCalledTimes(3);
    expect(transform).toHaveBeenNthCalledWith(1, strokes[0], 3, 0);
    expect(transform).toHaveBeenNthCalledWith(2, strokes[1], 3, 1);
    expect(transform).toHaveBeenNthCalledWith(3, strokes[2], 3, 2);
    expect(frame.map((entry) => entry.stroke.color)).toEqual(['#override', '#override', '#override']);
    expect(frame.map((entry) => entry.pointCount)).toEqual([4, 4, 4]);
  });

  it('passes erase-tool strokes through identically (schedule is tool-agnostic)', () => {
    const strokes = [stroke('#a', 4, 0), eraseStroke(6, 1)];
    const frame = hold(strokes, 4, 2);
    expect(frame.map((entry) => entry.stroke.tool)).toEqual(['paint', 'erase']);
    expect(frame[1].stroke).toBe(strokes[1]);
    expect(frame.map((entry) => entry.pointCount)).toEqual([4, 6]);
  });
});
