import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';
import { createRotoLivePixelCacheTransactions } from './rotoLivePixelCacheTransactions';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

class DelayedBlobCanvas {
  width = 320;
  height = 180;
  private blobCallback: BlobCallback | null = null;

  toBlob(callback: BlobCallback, type?: string): void {
    expect(type).toBe('image/png');
    this.blobCallback = callback;
  }

  finishEncoding(): void {
    this.blobCallback?.(new Blob(['encoded-pixels'], { type: 'image/png' }));
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Roto live pixel cache transactions', () => {
  it('lets a second capture return while the first PNG encoding remains pending', async () => {
    vi.useFakeTimers();
    const firstCanvas = new DelayedBlobCanvas();
    const secondCanvas = new DelayedBlobCanvas();
    const events: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();
    vi.stubGlobal('FileReader', class {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(blob: Blob): void {
        blob.arrayBuffer().then(() => {
          this.result = 'data:image/png;base64,ZW5jb2RlZC1waXhlbHM=';
          this.onload?.();
        }).catch(() => this.onerror?.());
      }
    });

    const firstWork = transactions.capture({
      sourceFrame: 7,
      produce: () => encodeRotoFrameFromCanvas(firstCanvas as unknown as HTMLCanvasElement, 7),
      commit: () => events.push('first-committed'),
    });
    await vi.advanceTimersByTimeAsync(0);

    const secondWork = transactions.capture({
      sourceFrame: 7,
      produce: () => encodeRotoFrameFromCanvas(secondCanvas as unknown as HTMLCanvasElement, 7),
      commit: () => events.push('second-committed'),
    });
    events.push('second-caller-returned');

    expect(events).toEqual(['second-caller-returned']);

    await vi.advanceTimersByTimeAsync(0);
    secondCanvas.finishEncoding();
    await expect(secondWork).resolves.toBe(true);
    firstCanvas.finishEncoding();
    await expect(firstWork).resolves.toBe(false);
    expect(events).toEqual(['second-caller-returned', 'second-committed']);
  });

  it('records handoff, producer, and accepted commit without changing capture behavior', async () => {
    vi.useFakeTimers();
    const samples: Array<{ stage: string; mutationId?: number; sourceFrame: number; outcome?: string }> = [];
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const work = transactions.capture({
      sourceFrame: 7,
      mutationId: 23,
      produce: async () => 'latest',
      commit: (value) => commits.push(value),
      recordPerformance: (sample) => samples.push(sample),
    });
    await vi.advanceTimersByTimeAsync(0);

    await expect(work).resolves.toBe(true);
    expect(commits).toEqual(['latest']);
    expect(samples).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'cache-task-handoff', mutationId: 23, sourceFrame: 7 }),
      expect.objectContaining({ stage: 'cache-producer', mutationId: 23, sourceFrame: 7 }),
      expect.objectContaining({ stage: 'cache-accepted-commit', mutationId: 23, sourceFrame: 7, outcome: 'accepted' }),
    ]));
  });

  it('skips obsolete same-frame work before its producer starts', async () => {
    vi.useFakeTimers();
    const firstProduce = vi.fn(async () => 'old');
    const secondProduce = vi.fn(async () => 'new');
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const oldWork = transactions.capture({ sourceFrame: 7, produce: firstProduce, commit: (value) => commits.push(value) });
    const newWork = transactions.capture({ sourceFrame: 7, produce: secondProduce, commit: (value) => commits.push(value) });
    await vi.advanceTimersByTimeAsync(0);

    await expect(oldWork).resolves.toBe(false);
    await expect(newWork).resolves.toBe(true);
    expect(firstProduce).not.toHaveBeenCalled();
    expect(secondProduce).toHaveBeenCalledOnce();
    expect(commits).toEqual(['new']);
  });

  it('flushes the latest pending revision at a disposal boundary', async () => {
    vi.useFakeTimers();
    const pending = deferred<string>();
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    void transactions.capture({ sourceFrame: 7, produce: () => pending.promise, commit: (value) => commits.push(value) });
    expect(transactions.hasPending(7)).toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    let flushed = false;
    const flush = transactions.flush(7).then(() => { flushed = true; });
    await Promise.resolve();
    expect(flushed).toBe(false);

    pending.resolve('latest');
    await flush;
    expect(commits).toEqual(['latest']);
    expect(transactions.hasPending(7)).toBe(false);
  });

  it('accepts only the latest revision for one source frame', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const oldWork = transactions.capture({ sourceFrame: 7, produce: () => first.promise, commit: (value) => commits.push(value) });
    const newWork = transactions.capture({ sourceFrame: 7, produce: () => second.promise, commit: (value) => commits.push(value) });
    second.resolve('new');
    await newWork;
    first.resolve('old');
    await oldWork;

    expect(commits).toEqual(['new']);
  });

  it('lets different source frames commit independently', async () => {
    const frameA = deferred<string>();
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const pendingA = transactions.capture({ sourceFrame: 1, produce: () => frameA.promise, commit: (value) => commits.push(value) });
    await transactions.capture({ sourceFrame: 2, produce: async () => 'frame-b', commit: (value) => commits.push(value) });
    expect(commits).toEqual(['frame-b']);
    frameA.resolve('frame-a');
    await pendingA;
    expect(commits).toEqual(['frame-b', 'frame-a']);
  });

  it('makes removal win over an older pending non-empty capture without stale side effects', async () => {
    const pending = deferred<string>();
    const commit = vi.fn();
    const remove = vi.fn();
    const transactions = createRotoLivePixelCacheTransactions();

    const oldWork = transactions.capture({ sourceFrame: 3, produce: () => pending.promise, commit });
    expect(transactions.remove(3, remove)).toBe(true);
    pending.resolve('stale-pixels');
    await oldWork;

    expect(remove).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
  });
});
