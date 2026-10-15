/**
 * Bake host unit contract (D-21 / HOST-04).
 *
 * Pins the two bake semantics D-21 names:
 *   - PlayScript bake ABORTS on dispose (a cancelled turn never commits)
 *   - long cuisson bakes use flush-survives-navigation (beginFlush/flush)
 *
 * Plus the ported finalizationQueue pattern guarantees: bounded slot pool,
 * generation-stale commits, never-rejecting produce/commit.
 *
 * Family: the host's own vitest (also collected by
 * `pnpm --filter efx-motion-editor exec vitest run` via app/vitest.config.ts).
 */
import { describe, expect, it } from 'vitest';
import { BAKE_TURN_CONCURRENCY, createBakeHost, type BakeTurnOutcome } from './bakeHost';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('createBakeHost — D-21 bake semantics', () => {
  it('PlayScript bake aborts on dispose: a cancelled turn never commits', async () => {
    const host = createBakeHost();
    const produceGate = deferred<string>();
    let committed = 0;

    const outcomePromise = host.submit({
      mode: 'abort-on-dispose',
      produce: () => produceGate.promise,
      commit: () => {
        committed += 1;
      },
    });

    // Let the turn reach its produce (slot take + pre-produce yield).
    await Promise.resolve();
    await Promise.resolve();
    host.dispose();

    // The produce settles AFTER dispose — the generation guard must skip commit.
    produceGate.resolve('late-pixels');
    const outcome = await outcomePromise;

    expect(outcome).toBe('cancelled');
    expect(committed).toBe(0);
  });

  it('flush-survives-navigation: a long cuisson bake completes across dispose', async () => {
    const host = createBakeHost();
    const produceGate = deferred<string>();
    let committed = 0;

    const outcomePromise = host.submit({
      mode: 'flush-survives-navigation',
      produce: () => produceGate.promise,
      commit: (value) => {
        committed += 1;
        return value === 'cuisson-pixels';
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    // Navigation: beginFlush + dispose. The long bake must survive.
    const release = host.beginFlush();
    host.dispose();
    produceGate.resolve('cuisson-pixels');

    const outcome = await outcomePromise;
    release();

    expect(outcome).toBe('committed');
    expect(committed).toBe(1);
  });

  it('beginFlush exists and is exercised by flush()', async () => {
    const host = createBakeHost();
    const order: string[] = [];

    const outcomes = [
      host.submit({
        produce: () => {
          order.push('produce-a');
          return 'a';
        },
        commit: (v) => {
          order.push(`commit-${v}`);
        },
      }),
      host.submit({
        produce: () => {
          order.push('produce-b');
          return 'b';
        },
        commit: (v) => {
          order.push(`commit-${v}`);
        },
      }),
    ];

    const release = host.beginFlush();
    expect(typeof release).toBe('function');
    await host.flush();
    release();

    const settled = await Promise.all(outcomes);
    expect(settled).toEqual(['committed', 'committed']);
    expect(order).toContain('produce-a');
    expect(order).toContain('commit-a');
    expect(order).toContain('produce-b');
    expect(order).toContain('commit-b');
  });
});

describe('createBakeHost — ported queue guarantees', () => {
  it('exports BAKE_TURN_CONCURRENCY and honours the slot-pool bound', async () => {
    expect(BAKE_TURN_CONCURRENCY).toBe(2);
    const host = createBakeHost({ concurrency: 2 });
    let maxParallel = 0;
    let running = 0;

    const makeTurn = (id: string) => ({
      produce: async () => {
        running += 1;
        maxParallel = Math.max(maxParallel, running);
        await new Promise((r) => setTimeout(r, 5));
        running -= 1;
        return id;
      },
    });

    const outcomes = await Promise.all([
      host.submit(makeTurn('t1')),
      host.submit(makeTurn('t2')),
      host.submit(makeTurn('t3')),
      host.submit(makeTurn('t4')),
    ]);
    expect(outcomes).toEqual(['committed', 'committed', 'committed', 'committed']);
    expect(maxParallel).toBeLessThanOrEqual(2);
  });

  it('generation-stale: interrupt() means a late produce never commits', async () => {
    const host = createBakeHost();
    const produceGate = deferred<string>();
    let committed = 0;

    const outcomePromise = host.submit({
      produce: () => produceGate.promise,
      commit: () => {
        committed += 1;
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    host.interrupt();
    produceGate.resolve('stale-pixels');

    const outcome = await outcomePromise;
    expect(outcome).toBe('cancelled');
    expect(committed).toBe(0);
  });

  it('never-rejecting produce: a throw settles failed and the queue keeps accepting', async () => {
    const host = createBakeHost();
    const bad = await host.submit({
      produce: () => {
        throw new Error('bad bake');
      },
      commit: () => {
        throw new Error('should not run');
      },
    });
    expect(bad).toBe('failed');

    const good = await host.submit({
      produce: () => 'ok',
      commit: () => true,
    });
    expect(good).toBe('committed');
  });

  it('never-rejecting commit: a throwing commit reports rejected, not a dead fiber', async () => {
    const host = createBakeHost();
    const outcome = await host.submit({
      produce: () => 'pixels',
      commit: () => {
        throw new Error('commit blew up');
      },
    });
    expect(outcome).toBe('rejected');
    // Queue still alive.
    const after = await host.submit({ produce: () => 'more' });
    expect(after).toBe('committed');
  });

  it('isStillWanted false before produce settles stale without producing', async () => {
    const host = createBakeHost();
    let produced = 0;
    const outcome = await host.submit({
      produce: () => {
        produced += 1;
        return 'x';
      },
      isStillWanted: () => false,
    });
    expect(outcome).toBe('stale');
    expect(produced).toBe(0);
  });

  it('dispose stops accepting abort-on-dispose work but drain still settles', async () => {
    const host = createBakeHost();
    host.dispose();
    const outcome = await host.submit({ produce: () => 'x' });
    expect(outcome).toBe('cancelled');
    await host.flush();
    expect(host.inFlight).toBe(0);
  });
});
