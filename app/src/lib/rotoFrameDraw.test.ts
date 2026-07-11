import { describe, expect, it, vi } from 'vitest';
import { physicPaintStore } from '../stores/physicPaintStore';
import { drawRotoFrameComposite, getMissingRotoFrameSpan, resolveMissingRotoFrameDraw } from './rotoFrameDraw';

describe('drawRotoFrameComposite', () => {
  it('composes persisted paper before transparent paint at authoritative project dimensions', () => {
    const operations: string[] = [];
    const context = {
      drawImage: (source: { id?: string }, ...args: number[]) => operations.push(`draw:${source.id ?? 'source'}:${args.join(',')}`),
      fillRect: () => operations.push('fill'),
      createPattern: () => ({ id: 'pattern' }),
      save: () => operations.push('save'),
      restore: () => operations.push('restore'),
      globalAlpha: 1,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    const instruction = resolveMissingRotoFrameDraw('phys-layer-1', 12, {
      mode: 'paper',
      metadata: { background: 'canvas2', paperGrain: 'canvas2', grainStrength: 0.65 },
    });

    if (instruction.kind !== 'background-only') throw new Error('expected paper background');
    drawRotoFrameComposite(context, instruction, 1600, 900, { id: 'paper' } as unknown as CanvasImageSource, null, { id: 'alpha' } as unknown as CanvasImageSource);

    expect(operations).toEqual([
      'save',
      'fill',
      'fill',
      'restore',
      'draw:alpha:0,0,1600,900',
    ]);
  });
});

describe('resolveMissingRotoFrameDraw', () => {
  it('resolves missing transparent Roto frames as playback-only no-op without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 24, {
      backgroundState: { mode: 'transparent' },
      realKeyFrames: [12, 36],
    });

    expect(result).toEqual({
      kind: 'transparent',
      span: { kind: 'interior', previousRealKeyFrame: 12, nextRealKeyFrame: 36 },
      materialize: false,
    });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('resolves persisted paper and canvas grain metadata for missing Roto frames before layer fallback', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 26, {
      backgroundState: {
        mode: 'paper',
        metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
      },
      realKeyFrames: [20, 30],
    });

    expect(result).toEqual({
      kind: 'background-only',
      color: '#ebe3d2',
      paperTexture: 'canvas2',
      paperGrain: 'canvas3',
      grainStrength: 0.65,
      span: { kind: 'interior', previousRealKeyFrame: 20, nextRealKeyFrame: 30 },
      materialize: true,
    });
    expect(setFrame).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('classifies strict interior missing frames as materialization-eligible and edge spans as dynamic', () => {
    expect(getMissingRotoFrameSpan(4, [2, 6])).toEqual({
      kind: 'interior',
      previousRealKeyFrame: 2,
      nextRealKeyFrame: 6,
    });
    expect(resolveMissingRotoFrameDraw('phys-layer-1', 4, {
      backgroundState: { mode: 'color', color: '#ffffff' },
      realKeyFrames: [2, 6],
    })).toEqual({
      kind: 'background-only',
      color: '#ffffff',
      span: { kind: 'interior', previousRealKeyFrame: 2, nextRealKeyFrame: 6 },
      materialize: true,
    });
    expect(resolveMissingRotoFrameDraw('phys-layer-1', 1, {
      backgroundState: { mode: 'color', color: '#ffffff' },
      realKeyFrames: [2, 6],
    })).toEqual({
      kind: 'background-only',
      color: '#ffffff',
      span: { kind: 'leading', nextRealKeyFrame: 2 },
      materialize: false,
    });
    expect(resolveMissingRotoFrameDraw('phys-layer-1', 8, {
      backgroundState: { mode: 'color', color: '#ffffff' },
      realKeyFrames: [2, 6],
    })).toEqual({
      kind: 'background-only',
      color: '#ffffff',
      span: { kind: 'trailing', previousRealKeyFrame: 6 },
      materialize: false,
    });
  });

  it('keeps leading and trailing background-only frames dynamic and non-materializable', () => {
    const leading = resolveMissingRotoFrameDraw('phys-layer-1', 1, {
      backgroundState: {
        mode: 'paper',
        metadata: { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.4 },
      },
      realKeyFrames: [2, 6],
    });
    const trailing = resolveMissingRotoFrameDraw('phys-layer-1', 8, {
      backgroundState: {
        mode: 'paper',
        metadata: { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.4 },
      },
      realKeyFrames: [2, 6],
    });

    expect(leading).toMatchObject({
      kind: 'background-only',
      color: '#f4efe3',
      span: { kind: 'leading', nextRealKeyFrame: 2 },
      materialize: false,
    });
    expect(trailing).toMatchObject({
      kind: 'background-only',
      color: '#f4efe3',
      span: { kind: 'trailing', previousRealKeyFrame: 6 },
      materialize: false,
    });
  });
});
