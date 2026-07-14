export interface RotoLivePixelCapture<T> {
  sourceFrame: number;
  mutationId?: number;
  produce: () => Promise<T> | T;
  commit: (value: T) => void;
  recordPerformance?: (sample: { stage: string; category: 'sync-cpu' | 'scheduled-wait' | 'async-elapsed'; durationMs: number; timestamp: number; mutationId?: number; sourceFrame: number; outcome?: string }) => void;
}

export interface RotoLivePixelCacheTransactions {
  capture: <T>(input: RotoLivePixelCapture<T>) => Promise<boolean>;
  remove: (sourceFrame: number, commit: () => void) => boolean;
  invalidate: (sourceFrame: number) => number;
  revision: (sourceFrame: number) => number;
  flush: (sourceFrame?: number) => Promise<void>;
  hasPending: (sourceFrame?: number) => boolean;
}

export function createRotoLivePixelCacheTransactions(): RotoLivePixelCacheTransactions {
  const revisions = new Map<number, number>();
  const pending = new Map<number, Promise<boolean>>();

  const invalidate = (sourceFrame: number) => {
    const revision = (revisions.get(sourceFrame) ?? 0) + 1;
    revisions.set(sourceFrame, revision);
    return revision;
  };

  return {
    capture<T>(input: RotoLivePixelCapture<T>): Promise<boolean> {
      const revision = invalidate(input.sourceFrame);
      const queuedAt = input.recordPerformance ? performance.now() : 0;
      const work = (async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const producerStartedAt = input.recordPerformance ? performance.now() : 0;
        input.recordPerformance?.({ stage: 'cache-task-handoff', category: 'scheduled-wait', durationMs: producerStartedAt - queuedAt, timestamp: producerStartedAt, mutationId: input.mutationId, sourceFrame: input.sourceFrame });
        if (revisions.get(input.sourceFrame) !== revision) {
          input.recordPerformance?.({ stage: 'cache-revision-check', category: 'sync-cpu', durationMs: 0, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.sourceFrame, outcome: 'stale-before-produce' });
          return false;
        }
        const value = await input.produce();
        input.recordPerformance?.({ stage: 'cache-producer', category: 'async-elapsed', durationMs: performance.now() - producerStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.sourceFrame });
        if (revisions.get(input.sourceFrame) !== revision) {
          input.recordPerformance?.({ stage: 'cache-revision-check', category: 'sync-cpu', durationMs: 0, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.sourceFrame, outcome: 'stale-before-commit' });
          return false;
        }
        const commitStartedAt = input.recordPerformance ? performance.now() : 0;
        input.commit(value);
        input.recordPerformance?.({ stage: 'cache-accepted-commit', category: 'sync-cpu', durationMs: performance.now() - commitStartedAt, timestamp: performance.now(), mutationId: input.mutationId, sourceFrame: input.sourceFrame, outcome: 'accepted' });
        return true;
      })();
      pending.set(input.sourceFrame, work);
      const clearPending = () => {
        if (pending.get(input.sourceFrame) === work) pending.delete(input.sourceFrame);
      };
      void work.then(clearPending, clearPending);
      return work;
    },
    remove(sourceFrame, commit) {
      invalidate(sourceFrame);
      commit();
      return true;
    },
    invalidate,
    revision: (sourceFrame) => revisions.get(sourceFrame) ?? 0,
    async flush(sourceFrame) {
      if (sourceFrame !== undefined) {
        await pending.get(sourceFrame);
        return;
      }
      await Promise.all(pending.values());
    },
    hasPending: (sourceFrame) => sourceFrame === undefined ? pending.size > 0 : pending.has(sourceFrame),
  };
}
