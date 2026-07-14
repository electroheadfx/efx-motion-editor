import { describe, expect, it, vi } from 'vitest';
import { createRotoLivePixelCacheTransactions } from './rotoLivePixelCacheTransactions';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('Roto live pixel cache transactions', () => {
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
