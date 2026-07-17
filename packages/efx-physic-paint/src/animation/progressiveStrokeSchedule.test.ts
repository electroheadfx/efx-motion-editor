import { describe, expect, it } from 'vitest';
import type { PaintStroke, PenPoint } from '../types';
import { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule';

const point = (index: number): PenPoint => ({ x: index, y: index * 2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 1 });
const stroke = (color: string, points: number, timestamp: number, playFrame?: number): PaintStroke => ({
  tool: 'paint', color, timestamp, ...(playFrame === undefined ? {} : { playFrame }),
  points: Array.from({ length: points }, (_, index) => point(index)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
  physicsMode: color === '#physics' ? 'local' : null,
});
const reveal = (strokes: readonly PaintStroke[], frames: number, frame: number) => getProgressiveFrameStrokes(buildProgressiveStrokeSchedule(strokes, frames), frame);
const count = (frame: ReturnType<typeof reveal>, color: string) => frame.find((entry) => entry.stroke.color === color)?.pointCount ?? 0;
const first = (strokes: readonly PaintStroke[], frames: number, color: string) => Array.from({ length: frames }, (_, frame) => reveal(strokes, frames, frame)).findIndex((entries) => count(entries, color) > 0);

describe('shared progressive stroke scheduler', () => {
  it('reconstructs stable recorded order and retains per-stroke properties', () => {
    const strokes = [stroke('#h', 4, 1), stroke('#e', 4, 2), stroke('#C', 4, 0), stroke('#physics', 4, 3)];
    const final = reveal(strokes, 8, 7);
    expect(final.map((entry) => entry.stroke.color)).toEqual(['#C', '#h', '#e', '#physics']);
    expect(final[3].stroke).toMatchObject({ physicsMode: 'local', params: { size: 8, opacity: 70, pressure: 65, pickup: 3 } });
    expect(final.map((entry) => entry.pointCount)).toEqual([4, 4, 4, 4]);
  });

  it('allocates weighted spans and reveals active strokes partially and cumulatively', () => {
    const strokes = [stroke('#short', 3, 0), stroke('#long', 15, 1), stroke('#tail', 3, 2)];
    const schedule = buildProgressiveStrokeSchedule(strokes, 9);
    expect(schedule[1].endFrame - schedule[1].startFrame).toBeGreaterThan(schedule[0].endFrame - schedule[0].startFrame);
    const active = reveal(strokes, 9, schedule[1].startFrame);
    expect(count(active, '#short')).toBe(3);
    expect(count(active, '#long')).toBeGreaterThan(0);
    expect(count(active, '#long')).toBeLessThan(15);
    expect(count(active, '#tail')).toBe(0);
  });

  it('spreads overflow, honors anchors, and orders same-anchor edits sequentially', () => {
    const base = Array.from({ length: 5 }, (_, index) => stroke(`#base-${index}`, 4, index));
    const edits = [stroke('#edit-a', 8, 5, 3), stroke('#edit-b', 8, 6, 3)];
    expect(first([...base, ...edits], 12, '#edit-a')).toBe(3);
    expect(first([...base, ...edits], 12, '#edit-b')).toBeGreaterThan(first([...base, ...edits], 12, '#edit-a'));
    const overflow = Array.from({ length: 20 }, (_, index) => stroke(`#overflow-${index}`, 4, index));
    expect(first(overflow, 16, '#overflow-19')).toBe(15);
  });

  it('inserts appended anchored edits into continuation order and completes the final frame', () => {
    const strokes = [
      stroke('#h', 4, 1, 1), stroke('#l', 4, 2, 2), stroke('#o', 4, 3, 3), stroke('#e', 4, 4, 4),
      stroke('#C', 4, 0, 0), stroke('#x', 4, 5, 3),
    ];
    const firstFrames = Object.fromEntries(strokes.map((entry) => [entry.color!, first(strokes, 12, entry.color!)]));
    expect(firstFrames['#C']).toBe(0);
    expect(firstFrames['#h']).toBeLessThan(firstFrames['#l']);
    expect(firstFrames['#l']).toBeLessThan(firstFrames['#x']);
    expect(firstFrames['#x']).toBeLessThan(firstFrames['#o']);
    expect(firstFrames['#o']).toBeLessThan(firstFrames['#e']);
    expect(reveal(strokes, 12, 11).every((entry) => entry.pointCount === entry.stroke.points.length)).toBe(true);
  });
});
