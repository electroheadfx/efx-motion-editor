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
      background: { background: 'transparent', grainStrength: 0 },
      subscribePaperCanvas,
    });

    expect(operations).toEqual(['clear:0,0,1280,720']);
    expect(subscribePaperCanvas).not.toHaveBeenCalled();
    expect(cleanup).toEqual(expect.any(Function));
  });

  it('subscribes to the background texture with NO procedural grain (260925-dso)', () => {
    const { context, operations } = createContext();
    const paperCanvas = { id: 'canvas2-raster' } as unknown as HTMLCanvasElement;
    const subscribePaperCanvas = vi.fn((_paperTexture, _width, _height, listener) => {
      listener(paperCanvas);
      return vi.fn();
    });

    subscribeRotoPlaybackBackground({
      context,
      width: 20,
      height: 10,
      background: { background: 'canvas2', grainStrength: 0.65 },
      subscribePaperCanvas,
    });

    expect(subscribePaperCanvas).toHaveBeenCalledWith('canvas2', 20, 10, expect.any(Function), 1);
    expect(operations).toContain('draw:canvas2-raster:0,0,20,10');
    // 260925-iy6: drawDeterministicPaperGrain is DELETED — no procedural dot grid.
    expect(operations.filter((op) => op.startsWith('fill:'))).toEqual([]);
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
      background: { background: 'canvas2', grainStrength: 0.65 },
      subscribePaperCanvas,
    });

    cleanup();
    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
