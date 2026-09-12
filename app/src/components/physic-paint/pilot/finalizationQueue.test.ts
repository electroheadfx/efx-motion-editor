import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFinalizationQueue,
  FINALIZATION_TURN_CONCURRENCY,
  type FinalizationQueue,
} from './finalizationQueue';
import { createFinalizationLifecycle, type FinalizationLifecycle } from './finalizationMachine';
import { markInteractionActive } from '../bridge/gestureIdleScheduler';

/**
 * D-16 pilot (52.2-14 Task 2): the capture produce/commit scheduler is a
 * bounded, backpressured, interruptible queue whose gate is the declared
 * lifecycle. These cases pin the four properties the promise-per-key map could
 * not express — a bounded turn count, real backpressure, interruption that
 * makes commit unreachable, and a drain that settles cancelled or committed.
 */
describe('stroke-finalization queue', () => {
  const lifecycles: FinalizationLifecycle[] = [];
  const queues: FinalizationQueue[] = [];

  const makeLifecycle = (): FinalizationLifecycle => {
    const lifecycle = createFinalizationLifecycle();
    lifecycles.push(lifecycle);
    return lifecycle;
  };

  const makeQueue = (options: { concurrency?: number; lifecycle?: FinalizationLifecycle } = {}): FinalizationQueue => {
    const queue = createFinalizationQueue({ lifecycle: options.lifecycle ?? makeLifecycle(), concurrency: options.concurrency });
    queues.push(queue);
    return queue;
  };

  /** Real-timer helper: each round flushes every pending macrotask and microtask. */
  const settle = async (rounds = 4): Promise<void> => {
    for (let round = 0; round < rounds; round += 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  };

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((next) => { resolve = next; });
    return { promise, resolve };
  }

  afterEach(() => {
    for (const queue of queues.splice(0)) queue.stop();
    for (const lifecycle of lifecycles.splice(0)) lifecycle.stop();
    vi.useRealTimers();
  });

  it('holds production until the lifecycle reaches the drain', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const produce = vi.fn(async () => 'pixels');
    const commit = vi.fn();

    lifecycle.pointerDown(1);
    const work = queue.submit({ produce, commit });
    await settle();
    expect(produce).not.toHaveBeenCalled();

    // A queued window is still closed: the gesture is over but the silence has
    // not elapsed, so the produce must not start.
    lifecycle.pointerUp(0);
    await settle();
    expect(produce).not.toHaveBeenCalled();

    lifecycle.idleWindowElapsed();
    await expect(work).resolves.toBe('committed');
    expect(produce).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith('pixels');
  });

  it('never runs more turns at once than the exported concurrency constant', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const gates = Array.from({ length: FINALIZATION_TURN_CONCURRENCY + 2 }, () => deferred<void>());
    let running = 0;
    let peak = 0;
    const produced: number[] = [];

    const works = gates.map((gate, index) => queue.submit({
      produce: async () => {
        running += 1;
        peak = Math.max(peak, running);
        produced.push(index);
        await gate.promise;
        running -= 1;
        return index;
      },
      commit: () => {},
    }));

    await settle();
    expect(produced).toHaveLength(FINALIZATION_TURN_CONCURRENCY);
    expect([...produced].sort()).toEqual(Array.from({ length: FINALIZATION_TURN_CONCURRENCY }, (_, index) => index));
    expect(peak).toBe(FINALIZATION_TURN_CONCURRENCY);

    for (const gate of gates) gate.resolve();
    await settle();
    expect(peak).toBeLessThanOrEqual(FINALIZATION_TURN_CONCURRENCY);
    await expect(Promise.all(works)).resolves.toEqual(works.map(() => 'committed'));
    expect(produced).toHaveLength(works.length);
  });

  it('backs the producer up: a submit past the limit settles only when a slot frees', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const gates = Array.from({ length: FINALIZATION_TURN_CONCURRENCY + 1 }, () => deferred<void>());
    const produced: number[] = [];
    let lastSettled = false;

    const works = gates.map((gate, index) => queue.submit({
      produce: async () => {
        produced.push(index);
        await gate.promise;
        return index;
      },
      commit: () => {},
    }));
    void works[works.length - 1].then(() => { lastSettled = true; });

    await settle();
    // Every slot is held: the extra submit must not have started producing and
    // must not have settled — the queue backpressures instead of growing.
    expect(produced).toHaveLength(FINALIZATION_TURN_CONCURRENCY);
    expect(lastSettled).toBe(false);

    gates[0].resolve();
    await settle();
    expect(produced).toHaveLength(FINALIZATION_TURN_CONCURRENCY + 1);
    expect(lastSettled).toBe(true);

    for (const gate of gates) gate.resolve();
    await settle();
  });

  it('cancels in-flight turns on interrupt so a cancelled turn can never commit', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const pixels = deferred<string>();
    const commit = vi.fn();
    const produce = vi.fn(() => pixels.promise);

    const work = queue.submit({ produce, commit });
    await settle();
    expect(produce).toHaveBeenCalledOnce();

    queue.interrupt();
    // The produce settles AFTER the interrupt: the continuation must not run.
    pixels.resolve('stale-pixels');
    await settle();

    await expect(work).resolves.toBe('cancelled');
    expect(commit).not.toHaveBeenCalled();
  });

  it('cancels turns still waiting for a slot without ever producing them', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle, concurrency: 1 });
    const held = deferred<void>();
    const secondProduce = vi.fn(async () => 'pixels');

    const first = queue.submit({ produce: () => held.promise, commit: () => {} });
    const second = queue.submit({ produce: secondProduce, commit: () => {} });
    await settle();

    queue.interrupt();
    held.resolve();
    await settle();

    await expect(first).resolves.toBe('cancelled');
    await expect(second).resolves.toBe('cancelled');
    expect(secondProduce).not.toHaveBeenCalled();
  });

  it('reports a failed turn without stopping the queue', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const commit = vi.fn();

    await expect(queue.submit({
      produce: () => { throw new Error('encode exploded'); },
      commit,
    })).resolves.toBe('failed');
    expect(commit).not.toHaveBeenCalled();

    await expect(queue.submit({ produce: async () => 'next-pixels', commit })).resolves.toBe('committed');
    expect(commit).toHaveBeenCalledWith('next-pixels');
  });

  it('skips a turn that is no longer wanted before producing and after producing', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const produce = vi.fn(async () => 'pixels');
    const commit = vi.fn();
    const stages: string[] = [];

    await expect(queue.submit({
      produce,
      commit,
      isStillWanted: (stage) => {
        stages.push(stage);
        return false;
      },
    })).resolves.toBe('stale');
    expect(stages).toEqual(['before-produce']);
    expect(produce).not.toHaveBeenCalled();

    await expect(queue.submit({
      produce,
      commit,
      isStillWanted: (stage) => {
        stages.push(stage);
        return stage === 'before-produce';
      },
    })).resolves.toBe('stale');
    expect(stages).toEqual(['before-produce', 'before-produce', 'before-commit']);
    expect(produce).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
  });

  it('drain resolves only once every accepted turn has settled', async () => {
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle, concurrency: 2 });
    const first = deferred<string>();
    const second = deferred<string>();
    let drained = false;

    const works = [
      queue.submit({ produce: () => first.promise, commit: () => {} }),
      queue.submit({ produce: () => second.promise, commit: () => {} }),
    ];
    const draining = queue.drain().then(() => { drained = true; });

    await settle();
    expect(drained).toBe(false);

    first.resolve('one');
    await settle();
    expect(drained).toBe(false);

    second.resolve('two');
    await settle();
    await expect(Promise.all(works)).resolves.toEqual(['committed', 'committed']);
    await draining;
    expect(drained).toBe(true);
    expect(queue.inFlight).toBe(0);
  });

  it('flush opens the gate and bypasses the quiescence window', async () => {
    vi.useFakeTimers();
    const lifecycle = makeLifecycle();
    const queue = makeQueue({ lifecycle });
    const produce = vi.fn(async () => 'pixels');
    const commit = vi.fn();

    // A recent interaction holds the quiescence window open; the lifecycle is
    // drainable, so only the window keeps the produce from starting.
    markInteractionActive();
    const work = queue.submit({ produce, commit, quiescenceMs: 6_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(produce).not.toHaveBeenCalled();

    const flushed = queue.flush();
    await expect(work).resolves.toBe('committed');
    await flushed;
    expect(produce).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith('pixels');
  });
});
