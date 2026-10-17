/**
 * 261017-mz9: warm-up pins — the prefetch goes through the worker client and
 * never builds a fond canvas on the main thread. Idempotent (second call is a
 * client cache hit), non-procedural ids are no-ops, failures never throw.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleProceduralPaperWarmup, warmProceduralPaperSheet } from './paperSheetWarmup';

const clientMock = vi.hoisted(() => ({
  requestProceduralSheet: vi.fn(async () => null),
}));
vi.mock('./paperSheetClient', () => clientMock);

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

const INPUT = {
  paperTexture: 'paper/cold-press',
  width: 16,
  height: 12,
  grainScale: 1,
};

beforeEach(() => {
  clientMock.requestProceduralSheet.mockClear();
  clientMock.requestProceduralSheet.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('261017-mz9 paperSheetWarmup', () => {
  it('warm-up prefetches through the client (no fond canvas built inline)', () => {
    warmProceduralPaperSheet(INPUT);
    expect(clientMock.requestProceduralSheet).toHaveBeenCalledTimes(1);
    expect(clientMock.requestProceduralSheet).toHaveBeenCalledWith(INPUT);
  });

  it('scheduleProceduralPaperWarmup defers the prefetch (does not run inline)', () => {
    vi.useFakeTimers();
    scheduleProceduralPaperWarmup(INPUT);
    expect(clientMock.requestProceduralSheet).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(clientMock.requestProceduralSheet).toHaveBeenCalledTimes(1);
  });

  it('warm-up of a non-procedural id is a no-op (jpg arm is decode-cached elsewhere)', () => {
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'paper/real-1' });
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'canvas1' });
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'photo' });
    expect(clientMock.requestProceduralSheet).not.toHaveBeenCalled();
  });

  it('hostile sizes / grain scale are no-ops and never throw', () => {
    expect(() => warmProceduralPaperSheet({ ...INPUT, width: 0 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, height: -1 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, grainScale: 0 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, grainScale: Number.NaN })).not.toThrow();
    expect(clientMock.requestProceduralSheet).not.toHaveBeenCalled();
  });

  it('warm-up failures never throw into the Studio', () => {
    clientMock.requestProceduralSheet.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => warmProceduralPaperSheet(INPUT)).not.toThrow();
    vi.useFakeTimers();
    expect(() => scheduleProceduralPaperWarmup(INPUT)).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('a second schedule with the same input is idempotent at the client (dedup owns the hit)', () => {
    vi.useFakeTimers();
    scheduleProceduralPaperWarmup(INPUT);
    vi.runAllTimers();
    expect(clientMock.requestProceduralSheet).toHaveBeenCalledTimes(1);
    scheduleProceduralPaperWarmup(INPUT);
    vi.runAllTimers();
    // Two prefetch kicks; the client dedups the second into a cache hit.
    expect(clientMock.requestProceduralSheet).toHaveBeenCalledTimes(2);
  });

  it('source-scan: the warm-up module does not build a fond canvas inline', () => {
    const src = source('src/lib/paperSheetWarmup.ts');
    expect(src).toContain('requestProceduralSheet');
    expect(src).not.toContain('getProjectPaperCanvas');
    expect(src).not.toContain('renderPaperSheet');
    expect(src).not.toContain('createElement');
  });
});
