import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';
import { CAPTURE_PRODUCE_QUIET_MS, createRotoLivePixelCacheTransactions } from './rotoLivePixelCacheTransactions';
import { FINALIZATION_TURN_CONCURRENCY } from '../pilot/finalizationQueue';
import { beginInteraction, endInteraction, GESTURE_IDLE_WINDOW_MS, interactionIdle } from '../bridge/gestureIdleScheduler';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const codec = vi.hoisted(() => ({ encode: vi.fn() }));
vi.mock('../../../lib/webpFrameCodec', () => ({ encodeWebpFrame: codec.encode }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

class DelayedWebpCanvas {
  width = 320;
  height = 180;

  getContext(kind: string): { getImageData: () => ImageData } | null {
    if (kind !== '2d') return null;
    return {
      getImageData: () => ({
        data: new Uint8ClampedArray(this.width * this.height * 4),
        width: this.width,
        height: this.height,
      }) as ImageData,
    };
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Roto live pixel cache transactions', () => {
  it('lets a second capture return while the first PNG encoding remains pending', async () => {
    vi.useFakeTimers();
    const firstCanvas = new DelayedWebpCanvas();
    const secondCanvas = new DelayedWebpCanvas();
    const firstEncoding = deferred<Uint8Array>();
    const secondEncoding = deferred<Uint8Array>();
    codec.encode
      .mockImplementationOnce(() => firstEncoding.promise)
      .mockImplementationOnce(() => secondEncoding.promise);
    const events: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

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
    secondEncoding.resolve(testWebpBytes('second'));
    await expect(secondWork).resolves.toBe(true);
    firstEncoding.resolve(testWebpBytes('first'));
    await expect(firstWork).resolves.toBe(false);
    expect(events).toEqual(['second-caller-returned', 'second-committed']);
  });

  it('reports a rejected commit without accepting the produced pixels', async () => {
    vi.useFakeTimers();
    const commit = vi.fn(async () => false);
    const transactions = createRotoLivePixelCacheTransactions();

    const work = transactions.capture({
      sourceFrame: 7,
      produce: async () => 'candidate',
      commit,
    });
    await vi.advanceTimersByTimeAsync(0);

    await expect(work).resolves.toBe(false);
    expect(commit).toHaveBeenCalledWith('candidate');
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

  it('advances cache revision when Undo republishes restored pixels with the same brush mutation id', async () => {
    const finalizedEncoding = deferred<string>();
    const commits: string[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const finalizedWork = transactions.capture({
      sourceFrame: 7,
      mutationId: 2,
      produce: () => finalizedEncoding.promise,
      commit: (value) => commits.push(value),
    });
    const undoWork = transactions.capture({
      sourceFrame: 7,
      mutationId: 2,
      produce: async () => 'restored-before-brush-2',
      commit: (value) => commits.push(value),
    });

    await expect(undoWork).resolves.toBe(true);
    finalizedEncoding.resolve('stale-finalized-brush-2');
    await expect(finalizedWork).resolves.toBe(false);

    expect(transactions.revision(7)).toBe(2);
    expect(commits).toEqual(['restored-before-brush-2']);
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

describe('Roto live pixel cache transactions — bounded turns and interruption (52.2-14)', () => {
  /** Real-timer helper: each round flushes every pending macrotask and microtask. */
  const settle = async (rounds = 4): Promise<void> => {
    for (let round = 0; round < rounds; round += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };

  it('cancels an in-flight capture on interrupt so its commit never runs', async () => {
    const encoding = deferred<string>();
    const commit = vi.fn();
    const produce = vi.fn(() => encoding.promise);
    const transactions = createRotoLivePixelCacheTransactions();

    const work = transactions.capture({ sourceFrame: 7, produce, commit });
    await settle();
    expect(produce).toHaveBeenCalledOnce();

    transactions.interrupt();
    // The encode settles AFTER the interrupt: a cancelled capture must be
    // unable to commit, which the promise-per-key map could not express.
    encoding.resolve('stale-pixels');
    await settle();

    await expect(work).resolves.toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(transactions.hasPending(7)).toBe(false);
  });

  it('runs captures at bounded concurrency and keeps every commit outcome', async () => {
    const gates = [0, 1, 2].map(() => deferred<void>());
    const produced: number[] = [];
    const committed: number[] = [];
    const transactions = createRotoLivePixelCacheTransactions();

    const works = gates.map((gate, index) => transactions.capture({
      sourceFrame: index,
      produce: async () => {
        produced.push(index);
        await gate.promise;
        return `frame-${index}`;
      },
      commit: () => {
        committed.push(index);
      },
    }));

    await settle();
    expect(produced).toHaveLength(FINALIZATION_TURN_CONCURRENCY);

    gates[0].resolve();
    await settle();
    expect(produced).toHaveLength(FINALIZATION_TURN_CONCURRENCY + 1);

    gates[1].resolve();
    gates[2].resolve();
    await settle();
    await expect(Promise.all(works)).resolves.toEqual([true, true, true]);
    expect([...committed].sort()).toEqual([0, 1, 2]);
    expect(transactions.hasPending()).toBe(false);
  });
});

describe('Roto live pixel cache transactions — gesture-idle gating', () => {
  afterEach(() => {
    interactionIdle.value = true;
  });

  it('defers produce until the idle transition while a gesture is active', async () => {
    // performance must be faked alongside timers: the produce quiet window
    // (Part 3) reads performance.now() directly.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    beginInteraction(1);
    const produce = vi.fn(async () => 'pixels');
    const commit = vi.fn();
    const transactions = createRotoLivePixelCacheTransactions();

    const work = transactions.capture({ sourceFrame: 7, produce, commit });
    await vi.advanceTimersByTimeAsync(0);
    expect(produce).not.toHaveBeenCalled();

    endInteraction(1);
    // 52.1 (Part 3): the idle transition alone is not enough — produce also
    // waits for the capture quiet window so a mid-burst pause never starts an
    // encode the next stroke would supersede.
    await vi.advanceTimersByTimeAsync(GESTURE_IDLE_WINDOW_MS);
    expect(produce).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CAPTURE_PRODUCE_QUIET_MS);
    await expect(work).resolves.toBe(true);
    expect(produce).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith('pixels');
  });

  it('forces a deferred produce synchronously on flush (navigation/close/save)', async () => {
    vi.useFakeTimers();
    beginInteraction(1);
    const produce = vi.fn(async () => 'pixels');
    const commit = vi.fn();
    const transactions = createRotoLivePixelCacheTransactions();

    const work = transactions.capture({ sourceFrame: 7, produce, commit });
    await vi.advanceTimersByTimeAsync(0);
    expect(produce).not.toHaveBeenCalled();

    await transactions.flush(7);
    await expect(work).resolves.toBe(true);
    expect(produce).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith('pixels');
  });
});
