import { describe, expect, it, vi } from 'vitest';
import { subscribeRotoPlaybackBackground } from './rotoPlaybackBackground';

function createContext() {
  const operations: string[] = [];
  const context = {
    clearRect: (...args: number[]) => operations.push(`clear:${args.join(',')}`),
    drawImage: (source: { id?: string }, ...args: number[]) => operations.push(`draw:${source.id ?? 'source'}:${args.join(',')}`),
    fillRect: (...args: number[]) => operations.push(`fill:${args.join(',')}`),
    createPattern: () => ({ id: 'pattern' }),
    save: () => operations.push('save'),
    restore: () => operations.push('restore'),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;
  return { context, operations };
}

describe('subscribeRotoPlaybackBackground', () => {
  it('keeps transparent playback clear without an opaque fill or paper subscription', () => {
    const { context, operations } = createContext();
    const subscribePaperCanvas = vi.fn();

    const cleanup = subscribeRotoPlaybackBackground({
      context,
      width: 1280,
      height: 720,
      background: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 },
      subscribePaperCanvas,
    });

    expect(operations).toEqual(['clear:0,0,1280,720']);
    expect(subscribePaperCanvas).not.toHaveBeenCalled();
    expect(cleanup).toEqual(expect.any(Function));
  });

  it('subscribes to the background texture while applying independent paper grain metadata', () => {
    const { context, operations } = createContext();
    const paperCanvas = { id: 'canvas2-raster' } as unknown as HTMLCanvasElement;
    const subscribePaperCanvas = vi.fn((paperTexture, width, height, listener) => {
      listener(paperCanvas);
      return vi.fn();
    });

    subscribeRotoPlaybackBackground({
      context,
      width: 20,
      height: 10,
      background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
      subscribePaperCanvas,
    });

    expect(subscribePaperCanvas).toHaveBeenCalledWith('canvas2', 20, 10, expect.any(Function));
    expect(operations).toContain('draw:canvas2-raster:0,0,20,10');
    expect(operations).toContain('fill:2,5,1,1');
    expect(operations.indexOf('draw:canvas2-raster:0,0,20,10')).toBeLessThan(operations.indexOf('fill:2,5,1,1'));
  });

  it('returns an idempotent raster cleanup for replacement or disposal', () => {
    const { context } = createContext();
    const unsubscribe = vi.fn();
    const subscribePaperCanvas = vi.fn((_paperTexture, _width, _height, listener) => {
      listener(null);
      return unsubscribe;
    });

    const cleanup = subscribeRotoPlaybackBackground({
      context,
      width: 20,
      height: 10,
      background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
      subscribePaperCanvas,
    });

    cleanup();
    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
