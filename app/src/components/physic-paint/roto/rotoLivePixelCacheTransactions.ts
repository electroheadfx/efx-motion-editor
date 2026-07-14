export interface RotoLivePixelCapture<T> {
  sourceFrame: number;
  produce: () => Promise<T> | T;
  commit: (value: T) => void;
}

export interface RotoLivePixelCacheTransactions {
  capture: <T>(input: RotoLivePixelCapture<T>) => Promise<boolean>;
  remove: (sourceFrame: number, commit: () => void) => boolean;
  invalidate: (sourceFrame: number) => number;
  revision: (sourceFrame: number) => number;
}

export function createRotoLivePixelCacheTransactions(): RotoLivePixelCacheTransactions {
  const revisions = new Map<number, number>();

  const invalidate = (sourceFrame: number) => {
    const revision = (revisions.get(sourceFrame) ?? 0) + 1;
    revisions.set(sourceFrame, revision);
    return revision;
  };

  return {
    async capture<T>(input: RotoLivePixelCapture<T>): Promise<boolean> {
      const revision = invalidate(input.sourceFrame);
      const value = await input.produce();
      if (revisions.get(input.sourceFrame) !== revision) return false;
      input.commit(value);
      return true;
    },
    remove(sourceFrame, commit) {
      invalidate(sourceFrame);
      commit();
      return true;
    },
    invalidate,
    revision: (sourceFrame) => revisions.get(sourceFrame) ?? 0,
  };
}
